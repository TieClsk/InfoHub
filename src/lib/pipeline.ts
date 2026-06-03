import { prisma } from '@/lib/db';
import { clusterByTitle, verifyAndMerge, scoreSingle, translateToChinese, filterIrrelevant, regenerateSummary, regenerateTags } from '@/lib/deepseek';
import type { MergedResult } from '@/lib/deepseek';

function shareSubstring(a: string, b: string, minLen = 5): boolean {
  for (let i = 0; i <= a.length - minLen; i++) {
    if (b.includes(a.slice(i, i + minLen))) return true;
  }
  return false;
}

function pairsToGroups(pairs: Array<[string, string]>): string[][] {
  const groups: string[][] = [];
  const idToGroup = new Map<string, number>();

  for (const [a, b] of pairs) {
    const ga = idToGroup.get(a);
    const gb = idToGroup.get(b);

    if (ga !== undefined && gb !== undefined) {
      // 合并两个组
      if (ga !== gb) {
        groups[ga]!.push(...groups[gb]!);
        for (const id of groups[gb]!) idToGroup.set(id, ga);
        groups[gb] = [];
      }
    } else if (ga !== undefined) {
      groups[ga]!.push(b);
      idToGroup.set(b, ga);
    } else if (gb !== undefined) {
      groups[gb]!.push(a);
      idToGroup.set(a, gb);
    } else {
      const idx = groups.length;
      groups.push([a, b]);
      idToGroup.set(a, idx);
      idToGroup.set(b, idx);
    }
  }

  return groups.filter((g) => g.length >= 2);
}

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

function isChinese(text: string): boolean {
  if (!text || text.length < 2) return false;
  const chineseChars = text.match(/[一-鿿]/g);
  if (!chineseChars) return false;
  return chineseChars.length / text.length > 0.2;
}

function isValidSummary(summary: string, title: string): boolean {
  if (!summary || summary.trim().length < 10) return false;
  if (/https?:\/\//.test(summary)) return false;
  if (summary.trim() === title.trim()) return false;
  if (title.length > 10 && summary.includes(title.slice(0, 10))) return false;
  if (!isChinese(summary)) return false;
  if (summary.startsWith('文章网址') || summary.startsWith('文章URL') || summary.includes('评论URL')) return false;
  return true;
}

// 获取有效的摘要或兜底
function getValidSummary(aiSummary: string, title: string, rawContent: string | null): string {
  if (isValidSummary(aiSummary, title)) return aiSummary;
  // 用原始内容兜底
  if (rawContent && rawContent.length > 20 && isChinese(rawContent) && !/https?:\/\//.test(rawContent)) {
    return rawContent.slice(0, 100);
  }
  // 最终兜底：用标题
  return title;
}

/** 将日期调整为前一天，确保凌晨定时处理的数据归类到"昨天" */
function dayBefore(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - 1);
  return r;
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

  // 2. Pass 1: 标题聚类
  // 第一步：代码层快速匹配（公共子串 ≥5 字 = 疑似同事件）
  const titleItems = unprocessed.map((r) => ({
    id: r.id,
    title: r.title,
    sourceName: sourceNameMap[r.sourceId] ?? r.sourceId,
  }));

  // 按来源分组
  const bySource = new Map<string, typeof titleItems>();
  for (const ti of titleItems) {
    const arr = bySource.get(ti.sourceName) || [];
    arr.push(ti);
    bySource.set(ti.sourceName, arr);
  }

  // 找出跨源匹配对（不同来源、共享 ≥5 字公共子串）
  const crossPairs: Array<[string, string]> = [];
  const srcNames = [...bySource.keys()];
  for (let i = 0; i < srcNames.length; i++) {
    for (let j = i + 1; j < srcNames.length; j++) {
      const itemsA = bySource.get(srcNames[i]!)!;
      const itemsB = bySource.get(srcNames[j]!)!;
      for (const a of itemsA) {
        for (const b of itemsB) {
          if (shareSubstring(a.title, b.title, 5)) {
            crossPairs.push([a.id, b.id]);
          }
        }
      }
    }
  }

  // 合并重叠对 → 聚类组
  const codeGroups = pairsToGroups(crossPairs);
  console.log(`  [cluster] code-level found ${crossPairs.length} cross-source pairs → ${codeGroups.length} groups`);

  // 第二步：AI 标题聚类补充（同源去重）
  const aiGroups: string[][] = [];
  const CLUSTER_BATCH = 20;
  for (let i = 0; i < titleItems.length; i += CLUSTER_BATCH) {
    const batch = titleItems.slice(i, i + CLUSTER_BATCH);
    const groups = await clusterByTitle(batch);
    for (const g of groups) aiGroups.push(g);
  }

  // 合并代码组 + AI 组
  const allGroups = mergeOverlappingGroups([...codeGroups, ...aiGroups]);
  const suspectedGroups = allGroups;

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

  // AI 过滤暂时关闭 — scoreSingle 的 prompt 已要求 AI 标记 irrelevant

  // 5. 写入数据库
  // 5a. 合并条目（高优先级）
  for (const m of mergedResults) {
    const rawItem = unprocessed.find((r) => r.id === m.keptId);
    if (!rawItem) continue;

    let mergedTitle = m.mergedTitle;
    let mergedSummary = getValidSummary(m.mergedSummary, mergedTitle, rawItem.content);
    if (rawItem.language === 'en' || !isChinese(mergedTitle)) {
      try {
        mergedTitle = await translateToChinese(mergedTitle);
        mergedSummary = await translateToChinese(mergedSummary);
      } catch { /* keep */ }
    }

    try {
      await prisma.processedContent.create({
        data: {
          rawContentId: rawItem.id,
          sourceId: rawItem.sourceId,
          sourceName: m.primarySourceName,
          category,
          subcategory: m.subcategory || null,
          title: mergedTitle,
          summary: mergedSummary,
          importance: m.importance,
          tags: JSON.stringify(m.tags),
          language: 'zh',
          publishedAt: dayBefore(rawItem.fetchedAt),
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

    summary = getValidSummary(summary, title, rawItem.content);

    if (rawItem.language === 'en' || !isChinese(title)) {
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
          publishedAt: dayBefore(rawItem.fetchedAt),
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

  // 6. 后处理：修复摘要≈标题 + 缺失标签
  const allItems = await prisma.processedContent.findMany({
    where: { category },
    select: { id: true, title: true, summary: true, sourceName: true, tags: true },
  });

  let fixedSummaries = 0;
  let fixedTags = 0;

  for (const item of allItems) {
    // 摘要≈标题 或 太短
    const badSummary = item.summary.trim() === item.title.trim() || item.summary.trim().length < 15;
    // 标签缺失
    let hasTags = false;
    try {
      const t = JSON.parse(item.tags || '[]');
      hasTags = Array.isArray(t) && t.length > 0;
    } catch { /* no tags */ }

    if (badSummary || !hasTags) {
      try {
        const updates: Record<string, string> = {};
        if (badSummary) {
          const s = await regenerateSummary(item.title, item.sourceName);
          if (s !== item.title) { updates['summary'] = s; fixedSummaries++; }
        }
        if (!hasTags) {
          const tags = await regenerateTags(item.title, item.summary);
          if (tags.length > 0) { updates['tags'] = JSON.stringify(tags); fixedTags++; }
        }
        if (Object.keys(updates).length > 0) {
          await prisma.processedContent.update({ where: { id: item.id }, data: updates });
        }
      } catch { /* skip */ }
    }
  }
  if (fixedSummaries > 0 || fixedTags > 0) console.log(`  [fix] summaries=${fixedSummaries} tags=${fixedTags}`);

  return {
    processed: mergedResults.length + singleResults.length,
    skipped: processedIds.size,
    errors,
  };
}

export async function cleanupRawContent(retentionDays = 2): Promise<{ deleted: number; duration: number }> {
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
