import { prisma } from '@/lib/db';
import { processBatch, translateToChinese } from '@/lib/deepseek';
import type { AIProcessInput, AIProcessOutput } from '@/types';

const BATCH_SIZE = 8; // 每批发给 DeepSeek 的条数

/**
 * 获取 DataSource 的 id→displayName 映射
 */
async function getSourceNameMap(): Promise<Record<string, string>> {
  const sources = await prisma.dataSource.findMany({
    select: { id: true, displayName: true },
  });
  const map: Record<string, string> = {};
  for (const s of sources) {
    map[s.id] = s.displayName;
  }
  return map;
}

/**
 * 批量处理指定板块的未处理原始数据
 */
export async function processCategory(
  category: string,
  limit = 50
): Promise<{ processed: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  const sourceNameMap = await getSourceNameMap();

  // 取该板块未处理的原始数据（按 fetchedAt 升序，先到先处理）
  const rawItems = await prisma.rawContent.findMany({
    where: {
      // 通过检查 createdAt 时间判断是否为新数据
      // 实际应用中可通过标记或对比 processedContent 来判断
    },
    orderBy: { fetchedAt: 'asc' },
    take: limit,
  });

  // 过滤掉已处理的（查询 processedContent 中已有的 rawContentId）
  const processedIds = await prisma.processedContent.findMany({
    where: { rawContentId: { in: rawItems.map((r) => r.id).filter(Boolean) as string[] } },
    select: { rawContentId: true },
  });
  const processedIdSet = new Set(
    processedIds.map((p) => p.rawContentId).filter(Boolean)
  );

  const unprocessed = rawItems.filter((r) => !processedIdSet.has(r.id));

  if (unprocessed.length === 0) {
    return { processed: 0, skipped: 0, errors: [] };
  }

  // 分批处理
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

      const results = await processBatch(aiInputs, sourceNameMap);

      // 写入 ProcessedContent
      for (const result of results) {
        if (result.isDuplicate) continue;

        const rawItem = batch.find((r) => r.id === result.id);
        if (!rawItem) continue;

        // 英文内容翻译
        let title = result.title;
        let summary = result.summary;
        if (rawItem.language === 'en') {
          try {
            title = await translateToChinese(title);
            summary = await translateToChinese(summary);
          } catch {
            // 翻译失败保留 AI 输出
          }
        }

        try {
          await prisma.processedContent.create({
            data: {
              rawContentId: rawItem.id,
              sourceId: rawItem.sourceId,
              sourceName: sourceNameMap[rawItem.sourceId] ?? rawItem.sourceId,
              category: category,
              subcategory: result.subcategory || null,
              title,
              summary,
              importance: result.importance,
              tags: result.tags,
              language: 'zh',
              publishedAt: rawItem.fetchedAt,
              metadata: {
                originalTitle: rawItem.title,
                originalLanguage: rawItem.language,
                sourceRank: rawItem.sourceRank,
              },
            },
          });
        } catch (err) {
          errors.push(
            `Failed to insert ProcessedContent for ${rawItem.id}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    } catch (err) {
      errors.push(
        `Batch ${i / BATCH_SIZE + 1} failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return {
    processed: unprocessed.length - errors.length,
    skipped: processedIdSet.size,
    errors,
  };
}

/**
 * 清理 14 天前的原始数据
 */
export async function cleanupRawContent(retentionDays = 14): Promise<{
  deleted: number;
  duration: number;
}> {
  const startTime = Date.now();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  // 先置空对应的 ProcessedContent.rawContentId
  const expiredIds = await prisma.rawContent.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { id: true },
  });
  const expiredIdList = expiredIds.map((r) => r.id);

  if (expiredIdList.length > 0) {
    await prisma.processedContent.updateMany({
      where: { rawContentId: { in: expiredIdList } },
      data: { rawContentId: null },
    });
  }

  // 删除过期原始数据
  const result = await prisma.rawContent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  const duration = Date.now() - startTime;
  return { deleted: result.count, duration };
}
