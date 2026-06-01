import { prisma } from '@/lib/db';
import { processBatch, translateToChinese } from '@/lib/deepseek';
import type { AIProcessInput } from '@/types';

const BATCH_SIZE = 10;

// AI 板块非科技关键词 — 代码层兜底过滤
const NON_TECH_KEYWORDS = [
  '歌曲', '音乐', '歌手', '演唱', '专辑', '歌词', '乐队',
  '足球', '篮球', '体育', '比赛', '联赛', '运动员',
  '电影', '电视剧', '综艺', '娱乐', '明星', '演员',
  '美食', '菜谱', '烹饪', '旅游', '景点',
  '猫', '狗', '宠物',
  '税收', '选举', '政党', '军事',
  '天文', '行星', '小行星', '超新星', '望远镜',
  '历史', '考古', '古代',
  '鲑鱼', '虹鳟', '鱼类', '栖息', '生态',
  '航空', '飞机', '航班', '飞行员',
  '招聘', '求职', '面试',
];

function isNonTechContent(title: string, tags: string): boolean {
  const combined = (title + tags).toLowerCase();
  // 如果标题超过 100 字符且不含 AI/技术关键词，很可能是非科技趣闻
  if (title.length > 80) {
    const techWords = /ai|模型|代码|编程|开源|api|数据|学习|芯片|gpu|模型|安全|隐私/i;
    if (!techWords.test(title)) return true;
  }
  return NON_TECH_KEYWORDS.some((kw) => combined.includes(kw));
}

async function getSourceNameMap(): Promise<Record<string, string>> {
  const sources = await prisma.dataSource.findMany({
    select: { name: true, displayName: true },
  });
  const map: Record<string, string> = {};
  for (const s of sources) {
    map[s.name] = s.displayName;
  }
  return map;
}

/**
 * 按板块取未处理 RawContent，调用 DeepSeek 处理后写入 ProcessedContent
 */
export async function processCategory(
  category: string,
  limit = 30
): Promise<{ processed: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  const sourceNameMap = await getSourceNameMap();

  // 获取该板块的 sourceId 列表
  const categorySources = await prisma.dataSource.findMany({
    where: { category },
    select: { name: true },
  });
  const sourceIds = categorySources.map((s) => s.name);

  if (sourceIds.length === 0) {
    return { processed: 0, skipped: 0, errors: [`No sources for category: ${category}`] };
  }

  // 取这些来源中未处理的 rawContent
  const rawItems = await prisma.rawContent.findMany({
    where: { sourceId: { in: sourceIds } },
    orderBy: { fetchedAt: 'asc' },
    take: limit,
  });

  // 过滤已处理
  const rawIds = rawItems.map((r) => r.id);
  const processedRows = await prisma.processedContent.findMany({
    where: { rawContentId: { in: rawIds } },
    select: { rawContentId: true },
  });
  const processedIdSet = new Set(
    processedRows.map((p) => p.rawContentId).filter(Boolean)
  );

  const unprocessed = rawItems.filter((r) => !processedIdSet.has(r.id));

  if (unprocessed.length === 0) {
    return { processed: 0, skipped: processedIdSet.size, errors: [] };
  }

  for (let i = 0; i < unprocessed.length; i += BATCH_SIZE) {
    const batch = unprocessed.slice(i, i + BATCH_SIZE);

    try {
      const aiInputs: AIProcessInput[] = batch.map((item) => ({
        id: item.id,
        sourceId: item.sourceId,
        sourceName: sourceNameMap[item.sourceId] ?? item.sourceId,
        title: item.title,
        content: item.content ?? undefined,
        sourceRank: item.sourceRank ?? undefined,
        externalUrl: item.externalUrl ?? undefined,
        language: item.language,
        publishedAt: item.fetchedAt.toISOString(),
      }));

      const results = await processBatch(aiInputs, sourceNameMap, category);

      for (const result of results) {
        if (result.isDuplicate) continue;
        if (category === 'ai' && result.irrelevant) continue;
        // 代码层兜底过滤：检测非科技关键词
        if (category === 'ai' && isNonTechContent(result.title, JSON.stringify(result.tags))) {
          continue;
        }

        const rawItem = batch.find((r) => r.id === result.id);
        if (!rawItem) continue;

        let title = result.title;
        let summary = result.summary;
        if (rawItem.language === 'en') {
          try {
            title = await translateToChinese(title);
            summary = await translateToChinese(summary);
          } catch {
            // 翻译失败保留原文
          }
        }

        try {
          await prisma.processedContent.create({
            data: {
              rawContentId: rawItem.id,
              sourceId: rawItem.sourceId,
              sourceName: sourceNameMap[rawItem.sourceId] ?? rawItem.sourceId,
              category,
              subcategory: result.subcategory || null,
              title,
              summary,
              importance: result.importance,
              tags: JSON.stringify(result.tags),
              language: 'zh',
              publishedAt: rawItem.fetchedAt,
              metadata: JSON.stringify({
                originalTitle: rawItem.title,
                originalLanguage: rawItem.language,
                sourceRank: rawItem.sourceRank,
                sourceUrl: rawItem.externalUrl ?? null,
              }),
            },
          });
        } catch (err) {
          errors.push(
            `Insert ${rawItem.id}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    } catch (err) {
      errors.push(
        `Batch ${i / BATCH_SIZE + 1}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return {
    processed: unprocessed.length - errors.length,
    skipped: processedIdSet.size,
    errors,
  };
}

export async function cleanupRawContent(retentionDays = 14): Promise<{
  deleted: number;
  duration: number;
}> {
  const startTime = Date.now();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const expired = await prisma.rawContent.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { id: true },
  });
  const expiredIds = expired.map((r) => r.id);

  if (expiredIds.length > 0) {
    await prisma.processedContent.updateMany({
      where: { rawContentId: { in: expiredIds } },
      data: { rawContentId: null },
    });
  }

  const result = await prisma.rawContent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return { deleted: result.count, duration: Date.now() - startTime };
}
