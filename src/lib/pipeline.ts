import { prisma } from '@/lib/db';
import { processBatch, translateToChinese } from '@/lib/deepseek';
import type { AIProcessInput } from '@/types';

const BATCH_SIZE = 6;

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
