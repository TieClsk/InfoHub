import { prisma } from '@/lib/db';
import { clusterByTitle, verifyAndMerge, scoreSingle, translateToChinese, filterIrrelevant } from '@/lib/deepseek';
import type { MergedResult } from '@/lib/deepseek';

function mergeOverlappingGroups(groups: string[][]): string[][] {
  const result: string[][] = [];
  const used = new Set<number>();

  for (let i = 0; i < groups.length; i++) {
    if (used.has(i)) continue;
    const merged = new Set(groups[i]!);
    used.add(i);

    // 检查是否有其他组有重叠 ID
    let changed = true;
    while (changed) {
      changed = false;
      for (let j = i + 1; j < groups.length; j++) {
        if (used.has(j)) continue;
        if (groups[j]!.some((id) => merged.has(id))) {
          for (const id of groups[j]!) merged.add(id);
          used.add(j);
          changed = true;
        }
      }
    }

    result.push([...merged]);
  }

  return result;
}

async function getSourceNameMap(): Promise<Record<string, string>> {
  const sources = await prisma.dataSource.findMany({ select: { name: true, displayName: true } });
  const map: Record<string, string> = {};
  for (const s of sources) map[s.name] = s.displayName;
  return map;
}

export async function processCategory(
  category: string,
  limit = 120
): Promise<{ processed: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  const sourceNameMap = await getSourceNameMap();

  const categorySources = await prisma.dataSource.findMany({
    where: { category },
    select: { name: true },
  });
  const sourceIds = categorySources.map((s) => s.name);
  if (sourceIds.length === 0) {
    return { processed: 0, skipped: 0, errors: ['No sources'] };
  }

  // 1. 全量采集
  const allRaw = await prisma.rawContent.findMany({
    where: { sourceId: { in: sourceIds } },
    orderBy: { fetchedAt: 'desc' },
    take: limit,
  });

  // 过滤已处理
  const allIds = allRaw.map((r) => r.id);
  const processedIds = new Set(
    (await prisma.processedContent.findMany({ where: { rawContentId: { in: allIds } }, select: { rawContentId: true } }))
      .map((p) => p.rawContentId).filter(Boolean)
  );
  const unprocessed = allRaw.filter((r) => !processedIds.has(r.id));
  if (unprocessed.length === 0) return { processed: 0, skipped: processedIds.size, errors: [] };

  // 2. Pass 1: AI 标题聚类 — 分批处理（每批 20 条，提高 AI 准确率）
  const titleItems = unprocessed.map((r) => ({
    id: r.id,
    title: r.title,
    sourceName: sourceNameMap[r.sourceId] ?? r.sourceId,
  }));

  // 分批调用，收集所有疑似组
  const allGroups: string[][] = [];
  const CLUSTER_BATCH = 20;
  for (let i = 0; i < titleItems.length; i += CLUSTER_BATCH) {
    const batch = titleItems.slice(i, i + CLUSTER_BATCH);
    const groups = await clusterByTitle(batch);
    for (const g of groups) allGroups.push(g);
    if (groups.length > 0) console.log(`  [cluster] batch ${Math.floor(i / CLUSTER_BATCH) + 1}: ${groups.length} groups found`);
  }

  // 跨批次合并：如果两个组共享 ID，合并它们
  const mergedGroups = mergeOverlappingGroups(allGroups);
  const suspectedGroups = mergedGroups.length > 0 ? mergedGroups : allGroups;

  // 追踪哪些 ID 已被合并
  const mergedIdSet = new Set<string>();
  const mergedResults: MergedResult[] = [];

  // 3. Pass 2: 逐个疑似组深度核实
  for (const groupIds of suspectedGroups) {
    const groupItems = groupIds
      .map((id) => unprocessed.find((r) => r.id === id))
      .filter(Boolean) as typeof unprocessed;

    if (groupItems.length < 2) continue;

    const verdictItems = groupItems.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content || r.title,
      sourceName: sourceNameMap[r.sourceId] ?? r.sourceId,
      sourceRank: r.sourceRank ?? undefined,
      externalUrl: r.externalUrl ?? undefined,
      language: r.language,
    }));

    const merged = await verifyAndMerge(verdictItems);
    if (merged) {
      mergedResults.push(merged);
      for (const id of groupIds) mergedIdSet.add(id);
    }
  }

  // 4. 剩余的单独条目（未被合并的）
  const remaining = unprocessed.filter((r) => !mergedIdSet.has(r.id));

  // AI 评分摘要（分批处理）
  const singleResults: Array<{ id: string; title: string; summary: string; importance: number; tags: string[]; subcategory: string }> = [];
  const BATCH = 15;
  for (let i = 0; i < remaining.length; i += BATCH) {
    const batch = remaining.slice(i, i + BATCH).map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content || r.title,
      sourceName: sourceNameMap[r.sourceId] ?? r.sourceId,
      sourceRank: r.sourceRank ?? undefined,
      externalUrl: r.externalUrl ?? undefined,
      language: r.language,
    }));
    const scores = await scoreSingle(batch);
    singleResults.push(...scores);
  }

  // AI 过滤（仅 ai 板块）
  if (category === 'ai') {
    const allResults = [...mergedResults.flatMap((m) => [{ id: m.keptId, title: m.mergedTitle, tags: m.tags }]), ...singleResults.map((s) => ({ id: s.id, title: s.title, tags: s.tags }))];
    const toRemove = await filterIrrelevant(allResults, category);
    const removeSet = new Set(toRemove);
    // 从 singleResults 中移除
    for (let i = singleResults.length - 1; i >= 0; i--) {
      if (removeSet.has(singleResults[i]!.id)) singleResults.splice(i, 1);
    }
    // 从 mergedResults 中移除
    for (let i = mergedResults.length - 1; i >= 0; i--) {
      if (removeSet.has(mergedResults[i]!.keptId)) mergedResults.splice(i, 1);
    }
  }

  // 5. 写入数据库
  // 5a. 合并条目（高优先级）
  for (const m of mergedResults) {
    const rawItem = unprocessed.find((r) => r.id === m.keptId);
    if (!rawItem) continue;

    try {
      await prisma.processedContent.create({
        data: {
          rawContentId: rawItem.id,
          sourceId: rawItem.sourceId,
          sourceName: m.primarySourceName,
          category,
          subcategory: m.subcategory || null,
          title: m.mergedTitle,
          summary: m.mergedSummary,
          importance: m.importance,
          tags: JSON.stringify(m.tags),
          language: 'zh',
          publishedAt: rawItem.fetchedAt,
          metadata: JSON.stringify({
            sourceRank: m.primarySourceRank,
            sourceUrl: m.primarySourceUrl,
            sourceCount: m.sourceCount,
            sourceNames: m.sourceNames,
          }),
        },
      });
    } catch (err) {
      errors.push(`Merged ${rawItem.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 5b. 单源条目
  const scoreMap = new Map(singleResults.map((s) => [s.id, s]));
  for (const rawItem of remaining) {
    const score = scoreMap.get(rawItem.id);
    if (!score) continue;

    let title = score.title;
    let summary = score.summary;
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
          subcategory: score.subcategory || null,
          title,
          summary,
          importance: score.importance,
          tags: JSON.stringify(score.tags),
          language: 'zh',
          publishedAt: rawItem.fetchedAt,
          metadata: JSON.stringify({
            sourceRank: rawItem.sourceRank,
            sourceUrl: rawItem.externalUrl,
            sourceCount: 1,
            sourceNames: [sourceNameMap[rawItem.sourceId] ?? rawItem.sourceId],
          }),
        },
      });
    } catch (err) {
      errors.push(`Single ${rawItem.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    processed: mergedResults.length + singleResults.length,
    skipped: processedIds.size,
    errors,
  };
}

export async function cleanupRawContent(retentionDays = 14): Promise<{ deleted: number; duration: number }> {
  const startTime = Date.now();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const expired = await prisma.rawContent.findMany({ where: { createdAt: { lt: cutoff } }, select: { id: true } });
  const expiredIds = expired.map((r) => r.id);

  if (expiredIds.length > 0) {
    await prisma.processedContent.updateMany({ where: { rawContentId: { in: expiredIds } }, data: { rawContentId: null } });
  }

  const result = await prisma.rawContent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return { deleted: result.count, duration: Date.now() - startTime };
}
