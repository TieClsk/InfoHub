export const PROMPTS = {
  BATCH_PROCESS: {
    version: '1.1',
    system:
      '你是专业新闻编辑。你擅长识别重复新闻、评估新闻重要性、撰写简洁摘要，以及为内容打标签分类。你必须严格返回 JSON 格式，不要输出其他内容。',
    template: `请处理以下 {{count}} 条内容（所属板块：{{category}}）：

任务：
1. 识别报道同一事件的条目，只保留最详细的一条（标记 isDuplicate: true 和 duplicateOf 指向被保留的 id）
2. 为每条内容评分（1-10，10 最重要）。参考 sourceRank（数值越大越热门），但需综合判断，不要机械照搬
3. 生成不超过 100 字的中文摘要
4. 分配二级分类和 1-3 个标签

标题和标签规则：
- 标题直接概括内容即可，不要添加板块名称前缀（如"GitHub热门项目："、"AI 新闻："等）
- 标签要具体有意义，不要使用板块通用标签（如"GitHub Trending"、"高星项目"、"热门新闻"、"开源项目"等无辨识度的词）
- 标签应使用技术栈名（Python、Rust）、公司名（微软、OpenAI）、具体领域（大模型、芯片、前端）等有区分度的词

内容列表：
{{items}}

请严格以 JSON 数组格式返回，每条格式：
{
  "id": "原始id",
  "title": "整理后的中文标题",
  "summary": "100字以内中文摘要",
  "importance": 1-10,
  "tags": ["具体标签"],
  "subcategory": "二级分类",
  "isDuplicate": false,
  "duplicateOf": null
}`,
  },

  WEEKLY_SUMMARY: {
    version: '1.0',
    system:
      '你是专业新闻编辑。你擅长从一周的精选新闻中提炼最重要的趋势和事件，生成结构化的周报。',
    template: `请根据以下一周精选新闻（importance ≥ 7），生成一份结构化 Markdown 周报。

周报格式：
## 本周概览
（2-3 句话总结本周最重要的趋势）

## 热点事件
（3-5 个最重要的新闻事件，每个带标题和简述）

## AI 领域动态
（AI 相关的重要进展）

## GitHub 精选
（值得关注的开源项目）

## 投资观察
（市场重要变化）

一周精选新闻：
{{items}}

请直接返回 Markdown 格式的周报内容。`,
  },
} as const;
