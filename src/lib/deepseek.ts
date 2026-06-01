import type { AIProcessInput, AIProcessOutput } from '@/types';
import { PROMPTS } from '@/config/prompts';

const BASE_URL = process.env['DEEPSEEK_BASE_URL'] || 'https://api.deepseek.com';
const API_KEY = process.env['DEEPSEEK_API_KEY'] || '';

interface ChatMessage {
  role: 'system' | 'user';
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
export async function translateToChinese(text: string): Promise<string> {
  if (!API_KEY) return text;

  try {
    const content = await chatCompletion([
      {
        role: 'system',
        content:
          '你是一个专业翻译。将以下英文内容翻译成中文。只返回译文，不要加任何解释。',
      },
      { role: 'user', content: text },
    ]);
    return content.trim();
  } catch {
    return text; // 翻译失败返回原文
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
