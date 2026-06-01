export const PROMPTS = {
  BATCH_PROCESS: {
    version: '2.0',
    system:
      '你是专业新闻编辑，核心任务是跨来源识别同一事件。你必须严格返回 JSON 格式，不要输出其他内容。',
    template: `你是专业新闻编辑，核心任务是跨来源识别同一事件。请处理以下 {{count}} 条内容：

最重要任务 — 跨源合并：
- 仔细检查每条内容，找出不同来源（sourceName 不同）但报道同一事件的条目
- 同一事件的判断标准：主题一致，即使标题措辞不同。例如"英伟达市值全球第一"和"英伟达成为全球最高市值上市企业"是同一事件
- 将同一事件的所有条目合并为一条，通过 mergedIds 列出被合并的 id
- 合并后的标题和摘要要综合所有来源的信息
- sourceCount 必须是不同来源的个数（sourceName 不同才算不同源），sourceNames 是所有来源名称

评分规则（关键）：
- 多源验证事件 = 高可信度 → 基础分 8-10
- 单源事件 → 基础分 5-7
- 3+ 来源报道同一事件 → 至少 9 分
- 2 来源报道同一事件 → 至少 7 分

{{#if eq category "github"}}
GitHub 特殊规则：
- 标题和摘要不要提及星数信息（星数单独展示）
- 标题格式：项目名：一句话功能简介
- 摘要聚焦项目功能、用途、技术特色
{{/if}}

{{#if eq category "ai"}}
AI 板块规则：
- 过滤非 AI/科技 相关内容：音乐娱乐、天文、历史趣闻标记 irrelevant: true
- AI 相关：大模型、机器学习、AI应用、AI安全、AI芯片、数据科学、编程开发、开源技术
{{/if}}

通用规则：
- 所有标题和摘要必须是中文，英文必须翻译
- 标题不加板块前缀
- 标签用技术栈名、公司名、具体领域

内容列表：
{{items}}

严格返回 JSON 数组，每条格式：
{
  "id": "主条目id",
  "title": "综合中文标题",
  "summary": "综合中文摘要100字内",
  "importance": 1-10,
  "tags": ["标签"],
  "subcategory": "分类",
  "isDuplicate": false,
  "duplicateOf": null,
  "irrelevant": false,
  "sourceCount": 1,
  "sourceNames": ["来源名"],
  "mergedIds": ["被合并id"]
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
