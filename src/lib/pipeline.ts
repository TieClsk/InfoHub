import { prisma } from '@/lib/db';
import { processBatch, translateToChinese, filterIrrelevant } from '@/lib/deepseek';
import type { AIProcessInput } from '@/types';

const BATCH_SIZE = 10;

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
 * 等比例取样：从该板块的各数据源中各取一部分，确保来源多样性
 */
async function getDiverseSamples(
  sourceIds: string[],
  totalLimit: number
) {
  const perSource = Math.max(5, Math.ceil(totalLimit / sourceIds.length));

  const allItems: Awaited<ReturnType<typeof prisma.rawContent.findMany>>[] = [];
  for (const sid of sourceIds) {
    const items = await prisma.rawContent.findMany({
      where: { sourceId: sid },
      orderBy: { fetchedAt: 'desc' },
      take: perSource,
    });
    allItems.push(items);
  }

  // 交错排列（避免同一来源挤在一起）
  const result: (typeof allItems)[number] = [];
  let hasMore = true;
  let idx = 0;
  while (hasMore) {
    hasMore = false;
    for (const items of allItems) {
      if (idx < items.length) {
        result.push(items[idx]!);
        hasMore = true;
      }
    }
    idx++;
  }

  return result.slice(0, totalLimit);
}

export async function processCategory(
  category: string,
  limit = 60
): Promise<{ processed: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  const sourceNameMap = await getSourceNameMap();

  const categorySources = await prisma.dataSource.findMany({
    where: { category },
    select: { name: true },
  });
  const sourceIds = categorySources.map((s) => s.name);

  if (sourceIds.length === 0) {
    return { processed: 0, skipped: 0, errors: [`No sources for category: ${category}`] };
  }

  // 等比例从各源取样
  const rawItems = await getDiverseSamples(sourceIds, limit);

  // 过滤已处理
  const rawIds = rawItems.map((r) => r.id);
  const processedRows = await prisma.processedContent.findMany({
    where: { rawContentId: { in: rawIds } },
    select: { rawContentId: true },
  });
  const processedIdSet = new Set(processedRows.map((p) => p.rawContentId).filter(Boolean));

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

      let irrelevantIds: Set<string> = new Set();
      if (category === 'ai') {
        const filterItems = results
          .filter((r) => !r.isDuplicate)
          .map((r) => ({ id: r.id, title: r.title, tags: r.tags }));
        const toRemove = await filterIrrelevant(filterItems, category);
        irrelevantIds = new Set(toRemove);
      }

      // 构建被合并 ID → 主条目映射
      const mergedIdMap = new Map<string, string>(); // mergedId → mainId
      for (const result of results) {
        if (result.mergedIds) {
          for (const mid of result.mergedIds) {
            mergedIdMap.set(mid, result.id);
          }
        }
      }

      for (const result of results) {
        if (result.isDuplicate) continue;
        if (category === 'ai' && result.irrelevant) continue;
        if (irrelevantIds.has(result.id)) continue;

        const rawItem = batch.find((r) => r.id === result.id);
        if (!rawItem) continue;

        // 收集被合并的来源信息
        const mergedRawItems = (result.mergedIds || [])
          .map((mid) => batch.find((r) => r.id === mid))
          .filter(Boolean) as typeof rawItem[];

        const allSourceNames = new Set<string>();
        allSourceNames.add(sourceNameMap[rawItem.sourceId] ?? rawItem.sourceId);
        for (const m of mergedRawItems) {
          allSourceNames.add(sourceNameMap[m.sourceId] ?? m.sourceId);
        }

        const mergedSourceNames = result.sourceNames && result.sourceNames.length > 0
          ? result.sourceNames
          : Array.from(allSourceNames);

        const sourceCount = Math.max(
          result.sourceCount || 1,
          mergedSourceNames.length
        );

        // 多源加权：3源以上+3，2源+1
        let importance = result.importance;
        if (sourceCount >= 3) importance = Math.min(10, importance + 3);
        else if (sourceCount >= 2) importance = Math.min(10, importance + 1);

        let title = result.title;
        let summary = result.summary;
        if (rawItem.language === 'en') {
          try {
            title = await translateToChinese(title);
            summary = await translateToChinese(summary);
          } catch { /* keep original */ }
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
              importance,
              tags: JSON.stringify(result.tags),
              language: 'zh',
              publishedAt: rawItem.fetchedAt,
              metadata: JSON.stringify({
                originalTitle: rawItem.title,
                originalLanguage: rawItem.language,
                sourceRank: rawItem.sourceRank,
                sourceUrl: rawItem.externalUrl ?? null,
                sourceCount,
                sourceNames: mergedSourceNames,
              }),
            },
          });
        } catch (err) {
          errors.push(`Insert ${rawItem.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch (err) {
      errors.push(`Batch ${i / BATCH_SIZE + 1}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { processed: unprocessed.length - errors.length, skipped: processedIdSet.size, errors };
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
