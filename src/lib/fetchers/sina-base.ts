import { fetchWithTimeout, insertRawContents, writeFetchLog } from '@/lib/fetcher-utils';
import type { FetcherResult, RawContentInput } from '@/types';

export interface SinaSource { sourceId: string; lid: string; }

export async function fetchSinaSource(config: SinaSource): Promise<FetcherResult<RawContentInput>> {
  const startTime = Date.now();
  const fetchedAt = new Date();
  const { sourceId, lid } = config;
  const allItems: RawContentInput[] = [];
  const seen = new Set<string>();

  // 翻 3 页，每页 50，共 ~150 条
  for (let page = 1; page <= 3; page++) {
    try {
      const url = `https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=${lid}&k=&num=50&page=${page}`;
      const response = await fetchWithTimeout(url, 8000);
      const json = (await response.json()) as { result: { data: Array<{ title: string; url: string; intro: string; ctime: string }> } };
      const items = json.result?.data || [];
      if (items.length === 0) break;

      for (const item of items) {
        const title = item.title || '';
        if (title.length < 4 || seen.has(title.slice(0, 20))) continue;
        seen.add(title.slice(0, 20));
        allItems.push({
          sourceId, externalId: item.url?.split('/').pop()?.slice(0, 50) || `${sourceId}-${page}-${allItems.length}`,
          externalUrl: item.url, title, content: item.intro,
          rawData: item as unknown as Record<string, unknown>, language: 'zh',
        });
      }
    } catch { break; }
  }

  const result = await insertRawContents(allItems, sourceId);
  const duration = Date.now() - startTime;
  await writeFetchLog(sourceId, result.newCount > 0 ? 'success' : 'partial', result.total, result.newCount, duration);
  return { success: result.newCount > 0, data: allItems, source: sourceId, fetchedAt };
}
