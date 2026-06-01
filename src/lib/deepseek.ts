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

async function chatCompletion(messages: ChatMessage[], retries = 3): Promise<string> {
  if (!API_KEY) throw new Error('DEEPSEEK_API_KEY not configured');

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({ model: 'deepseek-chat', messages, temperature: 0.3, max_tokens: 4096 }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`DeepSeek API error (${response.status}): ${errorBody.slice(0, 200)}`);
      }

      const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
      return data.choices[0]?.message?.content ?? '';
    } catch (error) {
      if (attempt === retries) throw error;
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
    }
  }
  throw new Error('unreachable');
}

function titlesShareMostWords(titles: string[]): boolean {
  if (titles.length < 2) return false;
  for (let i = 0; i < titles.length; i++) {
    for (let j = i + 1; j < titles.length; j++) {
      const a = titles[i]!;
      const b = titles[j]!;
      // 1. 公共子串 ≥4 个字符
      for (let k = 0; k <= a.length - 4; k++) {
        if (b.includes(a.slice(k, k + 4))) return true;
      }
      // 2. 字符重叠 >30%
      const aSet = new Set(a.split(''));
      const bSet = new Set(b.split(''));
      const intersection = [...aSet].filter((c) => bSet.has(c)).length;
      const union = new Set([...aSet, ...bSet]).size;
      if (intersection / union > 0.3) return true;
    }
  }
  return false;
}

function extractJson(content: string): string {
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) return jsonMatch[1].trim();
  const bracketMatch = content.match(/\[[\s\S]*\]/);
  if (bracketMatch) return bracketMatch[0];
  return content;
}

// ═══════════════════════════════════════════
// Pass 1: 标题聚类 — 快速扫描所有标题找出疑似同主题组
// ═══════════════════════════════════════════

interface TitleItem {
  id: string;
  title: string;
  sourceName: string;
}

/**
 * 返回疑似同主题的 ID 分组，如 [["id1","id3"], ["id5","id7","id9"]]
 */
export async function clusterByTitle(items: TitleItem[]): Promise<string[][]> {
  if (!API_KEY || items.length < 2) return [];

  const list = items.map((i) => `[${i.id}] ${i.title}（来源：${i.sourceName}）`).join('\n');

  try {
    const content = await chatCompletion([
      {
        role: 'system',
        content:
          '你是新闻聚类助手。只返回 JSON 数组，不要其他内容。如果没找到疑似同主题的条目，返回空数组 []。',
      },
      {
        role: 'user',
        content: `以下是从不同来源采集的新闻标题。请找出疑似报道同一事件的条目组（主题相同、事件一致，即使措辞不同）。

注意：
- 只有主题确实相同的才归为一组（如"英伟达市值全球第一"和"英伟达成全球最高市值上市企业"）
- 不要将相关但不同事件的条目合并（如"AI芯片"和"AI招聘"不是同一事件）
- 每组至少 2 条，必须是不同来源

${list}

请返回 JSON 数组，每个元素是一个 ID 数组（疑似同主题的条目组）：
[["id1", "id3"], ["id5", "id7"]]`,
      },
    ]);

    const jsonStr = extractJson(content);
    const groups: unknown = JSON.parse(jsonStr);
    if (!Array.isArray(groups)) return [];

    return groups.filter((g): g is string[] => Array.isArray(g) && g.length >= 2);
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════
// Pass 2: 深度核实 + 合并生成
// ═══════════════════════════════════════════

interface VerdictItem {
  id: string;
  title: string;
  content: string;
  sourceName: string;
  sourceRank?: number;
  externalUrl?: string;
  language: string;
}

export interface MergedResult {
  mergedTitle: string;
  mergedSummary: string;
  importance: number;
  tags: string[];
  subcategory: string;
  sourceNames: string[];
  sourceCount: number;
  keptId: string;
  mergedIds: string[];
  primarySourceName: string;
  primarySourceUrl?: string;
  primarySourceRank?: number;
}

/**
 * 核实一组疑似同主题条目，如果确实相同则合并
 */
export async function verifyAndMerge(
  group: VerdictItem[]
): Promise<MergedResult | null> {
  if (!API_KEY || group.length < 2) return null;

  const itemsText = group
    .map(
      (item, i) =>
        `[条目${i + 1}] 来源：${item.sourceName} | 标题：${item.title}\n内容：${item.content.slice(0, 300)}`
    )
    .join('\n\n');

  try {
    const content = await chatCompletion([
      {
        role: 'system',
        content: '你是专业中文新闻审核专家。判断多条新闻是否报道同一事件，如果是则合并生成纯中文输出。只返回 JSON。',
      },
      {
        role: 'user',
        content: `判断以下条目是否在报道同一事件/主题：

${itemsText}

重要：如果有可能是在说同一件事（即使措辞不同），就判断为 sameEvent: true。

返回 JSON：
- 同一事件：{"sameEvent": true, "mergedTitle": "纯中文标题", "mergedSummary": "50-100字中文简介，综合各来源信息，禁止重复标题和URL", "importance": 0.00-10.00小数（多源交叉验证的事件可适当加分但不用保证高分，根据事件本身重要性判断）, "tags": ["具体标签1","具体标签2"], "subcategory": "分类", "primaryIndex": 0}
- 完全不同事件：{"sameEvent": false}
（tags 不能为空，不能用"新闻""热点"等宽泛词）`,
      },
    ]);

    const jsonStr = extractJson(content);
    const result = JSON.parse(jsonStr) as {
      sameEvent: boolean;
      mergedTitle?: string;
      mergedSummary?: string;
      importance?: number;
      tags?: string[];
      subcategory?: string;
      primaryIndex?: number;
    };

    if (!result.sameEvent) {
      const sim = titlesShareMostWords(group.map((g) => g.title));
      if (!sim) return null;
      console.log(`  [verifyAndMerge] FORCE-MERGE (AI rejected but code found overlap): ${group.length} items from [${[...new Set(group.map(g=>g.sourceName))].join(',')}]`);
    } else {
      console.log(`  [verifyAndMerge] AI CONFIRMED merge: ${group.length} items from [${[...new Set(group.map(g=>g.sourceName))].join(',')}]`);
    }

    // 生成合并结果（优先用 AI 的，否则用最长标题作为主标题）
    const primaryIdx = result.sameEvent ? (result.primaryIndex ?? 0) : 0;
    const primary = group[primaryIdx] ?? group[0]!;
    const allIds = group.map((g) => g.id);
    const keptId = primary.id;
    const mergedIds = allIds.filter((id) => id !== keptId);
    const sourceNames = [...new Set(group.map((g) => g.sourceName))];

    return {
      mergedTitle: result.mergedTitle || primary.title,
      mergedSummary: result.mergedSummary || primary.content.slice(0, 100),
      importance: Math.min(10, (result.importance ?? 5) + (sourceNames.length >= 3 ? 1.5 : sourceNames.length >= 2 ? 0.8 : 0)),
      tags: result.tags || [],
      subcategory: result.subcategory || '',
      sourceNames,
      sourceCount: sourceNames.length,
      keptId,
      mergedIds,
      primarySourceName: primary.sourceName,
      primarySourceUrl: primary.externalUrl,
      primarySourceRank: primary.sourceRank,
    };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════
// 单条评分摘要（非合并项）
// ═══════════════════════════════════════════

export async function scoreSingle(items: VerdictItem[]): Promise<
  Array<{
    id: string;
    title: string;
    summary: string;
    importance: number;
    tags: string[];
    subcategory: string;
  }>
> {
  if (!API_KEY || items.length === 0) return [];

  const itemsText = items
    .map((item, i) => `[${i}] ID:${item.id} | 来源:${item.sourceName} | 标题:${item.title}\n内容:${item.content.slice(0, 300)}`)
    .join('\n\n');

  try {
    const content = await chatCompletion([
      { role: 'system', content: '你是专业中文新闻编辑。你必须确保所有输出都是纯中文。只返回 JSON 数组。' },
      {
        role: 'user',
        content: `对以下新闻逐条处理：

${itemsText}

要求（严格遵守）：
1. title：必须是纯中文标题。英文标题翻译为中文
2. summary：50-100字中文简介，介绍核心内容和背景。禁止重复标题，禁止包含URL
3. importance：0.00-10.00小数评分。基于事件本身重要性打分（不用给所有新闻高分，平淡新闻给3-5分，重要新闻6-8分，极重大才9+分）
4. tags：每条必须有1-3个中文标签。标签要具体（公司名、技术名、领域名），禁止使用"新闻""热点""国内""国际""科技"等宽泛词
5. subcategory：二级分类

返回 JSON 数组。每条必须包含所有字段，tags 不能为空数组：[{"id":"...", "title":"中文标题", "summary":"中文简介", "importance":6, "tags":["标签1","标签2"], "subcategory":"分类"}]`,
      },
    ]);

    const jsonStr = extractJson(content);
    const results: unknown = JSON.parse(jsonStr);
    if (!Array.isArray(results)) return [];

    return (results as Array<Record<string, unknown>>).map((r) => ({
      id: r['id'] as string,
      title: (r['title'] as string) || '',
      summary: (r['summary'] as string) || '',
      importance: typeof r['importance'] === 'number' ? r['importance'] : 5,
      tags: Array.isArray(r['tags']) ? (r['tags'] as string[]) : [],
      subcategory: (r['subcategory'] as string) || '',
    }));
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════
// 以下是旧版兼容函数
// ═══════════════════════════════════════════

function isChinese(text: string): boolean {
  const chineseChars = text.match(/[一-鿿]/g);
  if (!chineseChars) return false;
  return chineseChars.length / text.length > 0.3;
}

function needsTranslation(text: string): boolean {
  if (!text || text.trim().length < 5) return false;
  if (isChinese(text)) return false;
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
        content: '你是一个专业翻译。将以下英文内容翻译成中文。只返回译文，不要加任何解释。如果输入不是英文或无实质内容，原样返回。',
      },
      { role: 'user', content: text },
    ]);
    const result = content.trim();
    if (result.includes('请提供') || result.includes('好的') || result.length < 5) return text;
    return result;
  } catch {
    return text;
  }
}

/**
 * 单条摘要重新生成（标题≈摘要时修复）
 */
export async function regenerateTags(title: string, summary: string): Promise<string[]> {
  if (!API_KEY) return [];

  try {
    const content = await chatCompletion([
      { role: 'system', content: '你是新闻标签助手。只返回 JSON 字符串数组，不要其他内容。' },
      {
        role: 'user',
        content: `为以下新闻生成 1-3 个中文标签（技术栈、公司名、具体领域等有区分度的标签，不要通用标签如"新闻""热点"）：

标题：${title}
摘要：${summary}

返回 JSON 数组如：["标签1", "标签2"]`,
      },
    ]);
    const jsonStr = content.match(/\[[\s\S]*\]/)?.[0] || content;
    const tags: unknown = JSON.parse(jsonStr);
    return Array.isArray(tags) ? (tags as string[]).slice(0, 3) : [];
  } catch {
    return [];
  }
}

export async function regenerateSummary(title: string, sourceName: string): Promise<string> {
  if (!API_KEY) return title;

  try {
    const content = await chatCompletion([
      { role: 'system', content: '你是专业中文新闻编辑。只返回摘要文本，不要标题、不要URL、不要任何其他内容。' },
      {
        role: 'user',
        content: `请为以下新闻写一段50-100字的中文简介。简介应概括新闻的核心内容和背景，不要重复标题。

标题：${title}
来源：${sourceName}

只返回50-100字的中文简介：`,
      },
    ]);
    const summary = content.trim();
    // 过滤无效响应
    if (summary.length < 10 || summary === title || /https?:\/\//.test(summary)) {
      return title;
    }
    return summary;
  } catch {
    return title;
  }
}

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
    throw new Error(`DeepSeek returned non-array: ${content.slice(0, 300)}`);
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
    sourceCount: typeof r['sourceCount'] === 'number' ? r['sourceCount'] : undefined,
    sourceNames: Array.isArray(r['sourceNames']) ? (r['sourceNames'] as string[]) : undefined,
    mergedIds: Array.isArray(r['mergedIds']) ? (r['mergedIds'] as string[]) : undefined,
  }));
}

export async function generateWeeklySummary(
  items: Array<{ title: string; summary: string; category: string; tags: string[] | string }>
): Promise<string> {
  const normalized = items.map((item) => ({
    ...item,
    tags: typeof item.tags === 'string' ? (JSON.parse(item.tags) as string[]) : item.tags,
  }));

  const prompt = PROMPTS.WEEKLY_SUMMARY.template.replace(
    '{{items}}',
    JSON.stringify(normalized, null, 2)
  );

  const content = await chatCompletion([
    { role: 'system', content: PROMPTS.WEEKLY_SUMMARY.system },
    { role: 'user', content: prompt },
  ]);

  return content;
}

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
- 如果某条的核心内容与 ${category} 无关，即使标题中有技术词汇，也要过滤
- 例如："美联航767因蓝牙名称触发警报返航" → 核心是航空事故，应过滤
- 例如："动物栖息地恢复" → 核心是生态，应过滤
- 只保留核心内容属于 ${category} 领域的条目

只返回 JSON 数组，包含应过滤掉的 id：["id1", "id2"]`;

    const content = await chatCompletion([
      { role: 'system', content: '你是一个内容审核助手。只返回 JSON 数组，不要其他输出。' },
      { role: 'user', content: prompt },
    ]);

    const jsonStr = content.match(/\[[\s\S]*\]/)?.[0] || content;
    const ids: unknown = JSON.parse(jsonStr);
    return Array.isArray(ids) ? (ids as string[]) : [];
  } catch {
    return [];
  }
}

export async function generateDetailSummary(
  title: string,
  shortSummary: string,
  sourceUrl?: string | null
): Promise<string> {
  if (!API_KEY) return '';

  const context = [`标题：${title}`, `摘要：${shortSummary}`, sourceUrl ? `来源：${sourceUrl}` : null]
    .filter(Boolean)
    .join('\n');

  const content = await chatCompletion([
    {
      role: 'system',
      content: '你是一个博客编辑。请根据以下信息，用 200-300 字的中文撰写一段深度概述。内容包括：项目/事件的背景、核心特点、实际应用价值、相关技术细节或行业影响。语气专业但易读。直接返回正文，不要标题和Markdown标记。',
    },
    { role: 'user', content: context },
  ]);

  return content.trim();
}

export async function generateSuggestedQuestions(title: string, summary: string): Promise<string[]> {
  if (!API_KEY) return [];

  try {
    const content = await chatCompletion([
      {
        role: 'system',
        content: '你是一个好奇心强的读者。从以下内容中提炼 3 个读者可能会追问的问题。返回 JSON 字符串数组，不要其他内容。问题要有深度，不能是简单的"是什么"。',
      },
      { role: 'user', content: `标题：${title}\n摘要：${summary}\n\n请返回 3 个读者可能追问的问题：` },
    ]);

    const jsonStr = content.match(/\[[\s\S]*\]/)?.[0] || content;
    const questions: unknown = JSON.parse(jsonStr);
    return Array.isArray(questions) ? (questions as string[]).slice(0, 3) : [];
  } catch {
    return [];
  }
}

/**
 * 速览 — 按类别总结今日要闻
 */
interface OverviewItem {
  title: string;
  summary: string;
  sourceName: string;
  importance: number;
  publishedAt: string;
}

interface CategoryItems { label: string; icon: string; items: OverviewItem[]; }

export async function generateUnifiedOverview(
  categories: CategoryItems[]
): Promise<{ modules: Array<{ label: string; icon: string; content: string }>; questions: string[] }> {
  if (!API_KEY) return { modules: [], questions: [] };

  const now = new Date().toLocaleDateString('zh-CN');
  const sections = categories
    .map((c) => {
      const itemsText = c.items.slice(0, 10).map((i, idx) => `${idx + 1}. [${i.sourceName}] ${i.title} | ${i.summary}`).join('\n');
      return `## ${c.icon} ${c.label}\n${itemsText}`;
    }).join('\n\n');

  try {
    const content = await chatCompletion([
      { role: 'system', content: `你是资深新闻分析师。今天是${now}。生成今日InfoHub速览。返回JSON。` },
      { role: 'user', content: `今天是${now}。以下是各领域新闻Top10：

${sections}

生成6个模块（每个200-300字，content字段内必须是Markdown）：

Markdown格式要求：
- 每个模块用 ### 小标题分成2-3段
- 用 **加粗** 突出关键词、公司名、数据
- 用 - 列表呈现要点
- 绝对不要返回整段连续纯文本，必须结构化
- GitHub模块必须有：热门类型、代表项目、技术趋势
- 投资模块必须有：市场动态、趋势判断、关注方向

1. **时事热点** — 综合热点事件分析
2. **时政消息** — 政策外交动态分析
3. **科技领域** — AI/技术/开源趋势分析
4. **投资领域** — 财经市场趋势判断
5. **GitHub热榜** — 热门项目类型趋势
6. **舆论消息** — 社交热议焦点

返回JSON格式（content内必须是Markdown）：{"modules":[{"label":"时事热点","icon":"🔥","content":"### 小标题\\n\\n**加粗关键词**...\\n\\n- 要点"}],"questions":["追问1"]}` },
    ]);

    const raw = content.trim();
    try {
      const cm = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const json = JSON.parse(cm?.[1]?.trim() || raw.match(/\{[\s\S]*\}/)?.[0] || raw) as { modules?: Array<{ label: string; icon: string; content: string }>; questions?: string[] };
      return { modules: json.modules || [], questions: Array.isArray(json.questions) ? json.questions.slice(0, 5) : [] };
    } catch {
      return { modules: [{ label: '速览', icon: '📋', content: raw.slice(0, 2000) }], questions: [] };
    }
  } catch { return { modules: [], questions: [] }; }
}

export async function generateOverview(
  categoryLabel: string,
  items: OverviewItem[]
): Promise<{ overview: string; questions: string[] }> {
  if (!API_KEY || items.length === 0) return { overview: '暂无数据。', questions: [] };

  const itemsText = items
    .map((i, idx) => `${idx + 1}. [${i.sourceName}] ${i.title}\n   摘要：${i.summary}\n   时间：${i.publishedAt}`)
    .join('\n');

  const now = new Date().toLocaleDateString('zh-CN');

  try {
    const content = await chatCompletion([
      {
        role: 'system',
        content: `你是专业新闻编辑。今天是${now}。请生成今日速览并附带推荐问题。返回 JSON 格式。`,
      },
      {
        role: 'user',
        content: `今天是${now}。以下是今天${categoryLabel}领域评分最高的新闻：

${itemsText}

请返回 JSON：
{
  "overview": "200-300字的今日${categoryLabel}速览（Markdown格式，用**加粗**、- 列表等）。总结今天这个领域的主要事件和值得关注的趋势。忽略超过24小时的旧闻。",
  "questions": ["3个读者可能会追问的具体问题"]
}`,
      },
    ]);

    const raw = content.trim();
    let json: { overview?: string; questions?: string[] };

    try {
      // 优先解析代码块中的 JSON
      const codeMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = codeMatch?.[1]?.trim() || raw.match(/\{[\s\S]*\}/)?.[0] || raw;
      json = JSON.parse(jsonStr) as { overview?: string; questions?: string[] };
    } catch {
      // 解析失败：把原始文本当作 overview
      console.error(`[generateOverview] JSON parse failed for ${categoryLabel}, raw:`, raw.slice(0, 200));
      return { overview: raw.slice(0, 500).trim() || '生成失败。', questions: [] };
    }

    return {
      overview: json.overview || '生成失败。',
      questions: Array.isArray(json.questions) ? json.questions.slice(0, 3) : [],
    };
  } catch {
    return { overview: '生成失败，请稍后重试。', questions: [] };
  }
}

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
