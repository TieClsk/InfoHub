import type { AIProcessInput, AIProcessOutput } from '@/types';
import { PROMPTS } from '@/config/prompts';

const BASE_URL = process.env['DEEPSEEK_BASE_URL'] || 'https://api.deepseek.com';
const API_KEY = process.env['DEEPSEEK_API_KEY'] || '';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function chatCompletion(
  messages: ChatMessage[],
  retries = 3
): Promise<string> {
  if (!API_KEY) {
    throw new Error('DEEPSEEK_API_KEY not configured');
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages,
          temperature: 0.3,
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `DeepSeek API error (${response.status}): ${errorBody.slice(0, 200)}`
        );
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      return data.choices[0]?.message?.content ?? '';
    } catch (error) {
      if (attempt === retries) throw error;
      const delay = Math.pow(2, attempt - 1) * 1000; // 1s → 2s → 4s
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw new Error('unreachable');
}

function extractJson(content: string): string {
  // 处理可能包裹在 ```json ... ``` 中的响应
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) return jsonMatch[1].trim();
  // 尝试找 JSON 数组
  const bracketMatch = content.match(/\[[\s\S]*\]/);
  if (bracketMatch) return bracketMatch[0];
  return content;
}

/**
 * 批量处理新闻：去重、评分、摘要、分类、翻译
 */
export async function processBatch(
  items: AIProcessInput[],
  sourceNameMap: Record<string, string>,
  category: string
): Promise<AIProcessOutput[]> {
  const itemsForAI = items.map((item) => ({
    id: item.id,
    title: item.title,
    content: item.content?.slice(0, 500) ?? '',
    sourceRank: item.sourceRank ?? 0,
    sourceId: item.sourceId,
    sourceName: sourceNameMap[item.sourceId] ?? item.sourceId,
    language: item.language,
    externalUrl: item.externalUrl,
    publishedAt: item.publishedAt,
  }));

  let prompt = PROMPTS.BATCH_PROCESS.template
    .replace('{{category}}', category)
    .replace('{{count}}', String(itemsForAI.length))
    .replace('{{items}}', JSON.stringify(itemsForAI, null, 2));

  // 处理 {{#if eq category "xxx"}} 条件块
  const categories = ['github', 'ai'];
  for (const cat of categories) {
    const ifTag = `{{#if eq category "${cat}"}}`;
    if (category === cat) {
      prompt = prompt.replace(new RegExp(escapeRegExp(ifTag), 'g'), '');
    } else {
      prompt = prompt.replace(
        new RegExp(escapeRegExp(ifTag) + '[\\s\\S]*?' + escapeRegExp('{{/if}}'), 'g'),
        ''
      );
    }
    prompt = prompt.replace(/\{\{\/if\}\}/g, '');
  }

  const content = await chatCompletion([
    { role: 'system', content: PROMPTS.BATCH_PROCESS.system },
    { role: 'user', content: prompt },
  ]);

  const jsonStr = extractJson(content);
  const results: unknown = JSON.parse(jsonStr);

  if (!Array.isArray(results)) {
    throw new Error(`DeepSeek returned non-array response: ${content.slice(0, 300)}`);
  }

  return results.map((r: Record<string, unknown>) => ({
    id: r['id'] as string,
    title: (r['title'] as string) || '',
    summary: (r['summary'] as string) || '',
    importance: typeof r['importance'] === 'number' ? r['importance'] : 5,
    tags: Array.isArray(r['tags']) ? (r['tags'] as string[]) : [],
    subcategory: (r['subcategory'] as string) || '',
    isDuplicate: Boolean(r['isDuplicate']),
    duplicateOf: r['duplicateOf'] as string | undefined,
    irrelevant: r['irrelevant'] === true,
  }));
}

/**
 * 生成周报
 */
export async function generateWeeklySummary(
  items: Array<{ title: string; summary: string; category: string; tags: string[] | string }>
): Promise<string> {
  const normalized = items.map((item) => ({
    ...item,
    tags: typeof item.tags === 'string' ? (JSON.parse(item.tags) as string[]) : item.tags,
  }));
  const prompt = PROMPTS.WEEKLY_SUMMARY.template.replace(
    '{{items}}',
    JSON.stringify(items, null, 2)
  );

  const content = await chatCompletion([
    { role: 'system', content: PROMPTS.WEEKLY_SUMMARY.system },
    { role: 'user', content: prompt },
  ]);

  return content;
}

/**
 * 翻译英文内容为中文
 */
function isChinese(text: string): boolean {
  // 如果中文字符占比超过 30%，视为已是中文
  const chineseChars = text.match(/[一-鿿]/g);
  if (!chineseChars) return false;
  return chineseChars.length / text.length > 0.3;
}

function needsTranslation(text: string): boolean {
  if (!text || text.trim().length < 5) return false;
  if (isChinese(text)) return false;
  // 过滤掉纯 URL、代码、数字符号等
  const alphaChars = text.match(/[a-zA-Z]/g);
  return alphaChars !== null && alphaChars.length > 10;
}

export async function translateToChinese(text: string): Promise<string> {
  if (!API_KEY) return text;
  if (!needsTranslation(text)) return text;

  try {
    const content = await chatCompletion([
      {
        role: 'system',
        content:
          '你是一个专业翻译。将以下英文内容翻译成中文。只返回译文，不要加任何解释。如果输入不是英文或无实质内容，原样返回。',
      },
      { role: 'user', content: text },
    ]);
    const result = content.trim();
    // 如果返回的是 meta 响应（如"好的，请提供..."），说明翻译失败
    if (result.includes('请提供') || result.includes('好的') || result.length < 5) {
      return text;
    }
    return result;
  } catch {
    return text;
  }
}

/**
 * 生成详细概述（用于详情弹窗）
 */
export async function generateDetailSummary(
  title: string,
  shortSummary: string,
  sourceUrl?: string | null
): Promise<string> {
  if (!API_KEY) return '';

  const context = [
    `标题：${title}`,
    `摘要：${shortSummary}`,
    sourceUrl ? `来源：${sourceUrl}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const content = await chatCompletion([
    {
      role: 'system',
      content:
        '你是一个博客编辑。请根据以下信息，用 200-300 字的中文撰写一段深度概述。内容包括：项目/事件的背景、核心特点、实际应用价值、相关技术细节或行业影响。语气专业但易读。直接返回正文，不要标题和Markdown标记。',
    },
    { role: 'user', content: context },
  ]);

  return content.trim();
}

/**
 * AI 专用过滤：判断哪些条目不属于 AI/科技 板块
 * 返回应被过滤掉的 id 列表
 */
export async function filterIrrelevant(
  items: Array<{ id: string; title: string; tags: string[] }>,
  category: string
): Promise<string[]> {
  if (!API_KEY || items.length === 0) return [];

  const categoryRules: Record<string, string> = {
    ai: `AI/科技板块只保留以下内容：
- 人工智能、大模型、机器学习、深度学习、NLP、CV
- AI 应用、AI 安全、AI 芯片、AI 伦理
- 数据科学、编程开发、开源项目（有技术含量的）
- 云计算、网络安全、半导体
- 科技公司重要动态（Meta/Google/微软/英伟达等）

排除以下内容（即使有科技词汇也要排除）：
- 音乐、娱乐、体育、美食、旅游
- 历史趣闻、天文、生态、动物
- 招聘求职、面试（即使是科技公司）
- 交通、航空、航班（即使提到蓝牙或其他技术词汇）
- 键盘、笔记本等纯硬件测评（非芯片/AI硬件）
- 开源地点数据、数据集等纯数据内容
- 如果只是某个普通产品的介绍，不涉及AI技术，也要排除
- 如果一条新闻的核心内容与AI/科技无关，即使提到了技术词汇也要排除`,
  };

  const rule = categoryRules[category];
  if (!rule) return [];

  try {
    const prompt = `你是内容审核员。请过滤掉不属于"${category}"板块的条目。

${rule}

以下是待审核条目：
${items.map((i, idx) => `${idx + 1}. [${i.id}] ${i.title}（标签：${i.tags.join('、')}）`).join('\n')}

重要提示：
- 如果某条的核心内容与 ${category} 无关，即使标题中有技术词汇（如"蓝牙"、"AI"），也要过滤
- 例如："美联航767因蓝牙名称触发警报返航" → 核心是航空事故，不是科技新闻，应过滤
- 例如："招聘AI工程师" → 核心是招聘，应过滤
- 例如："动物栖息地恢复" → 核心是生态，应过滤
- 只保留核心内容属于 ${category} 领域的条目

只返回 JSON 数组，包含应过滤掉的 id：["id1", "id2"]`;

    const content = await chatCompletion([
      {
        role: 'system',
        content: '你是一个内容审核助手。只返回 JSON 数组，不要其他输出。',
      },
      { role: 'user', content: prompt },
    ]);

    const jsonStr = content.match(/\[[\s\S]*\]/)?.[0] || content;
    const ids: unknown = JSON.parse(jsonStr);
    return Array.isArray(ids) ? (ids as string[]) : [];
  } catch {
    return []; // API 失败时不过滤
  }
}

/**
 * 生成 3 个推荐追问
 */
export async function generateSuggestedQuestions(
  title: string,
  summary: string
): Promise<string[]> {
  if (!API_KEY) return [];

  try {
    const content = await chatCompletion([
      {
        role: 'system',
        content:
          '你是一个好奇心强的读者。从以下内容中提炼 3 个读者可能会追问的问题。返回 JSON 字符串数组，不要其他内容。问题要有深度，不能是简单的"是什么"。',
      },
      {
        role: 'user',
        content: `标题：${title}\n摘要：${summary}\n\n请返回 3 个读者可能追问的问题：`,
      },
    ]);

    const jsonStr = content.match(/\[[\s\S]*\]/)?.[0] || content;
    const questions: unknown = JSON.parse(jsonStr);
    return Array.isArray(questions) ? (questions as string[]).slice(0, 3) : [];
  } catch {
    return [];
  }
}

/**
 * AI 问答对话
 */
export async function chatAboutContent(
  title: string,
  summary: string,
  detailSummary: string,
  question: string,
  history: Array<{ role: string; content: string }>
): Promise<string> {
  if (!API_KEY) return 'AI 服务未配置，请设置 DEEPSEEK_API_KEY。';

  const context = `你是一个知识渊博的助手。用户正在阅读以下内容，请基于内容和你的知识回答问题。如果问题与内容无关，可以适当延伸。回答简洁、专业、中文。

内容标题：${title}
内容摘要：${summary}
${detailSummary ? `深度概述：${detailSummary}` : ''}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: context },
    ...history.map((h): ChatMessage => ({
      role: h.role === 'assistant' ? 'assistant' : 'user',
      content: h.content,
    })),
    { role: 'user', content: question },
  ];

  const content = await chatCompletion(messages);
  return content;
}
