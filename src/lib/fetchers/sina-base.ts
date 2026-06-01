import { fetchWithTimeout, insertRawContents, writeFetchLog } from '@/lib/fetcher-utils';
import type { FetcherResult, RawContentInput } from '@/types';

export interface SinaSource {
  sourceId: string;
  lid: string;
}

export async function fetchSinaSource(config: SinaSource): Promise<FetcherResult<RawContentInput>> {
  const startTime = Date.now();
  const fetchedAt = new Date();
  const { sourceId, lid } = config;

  try {
    const url = `https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=${lid}&k=&num=30&page=1`;
    const response = await fetchWithTimeout(url, 8000);
    const json = (await response.json()) as {
      result: { data: Array<{ title: string; url: string; intro: string; ctime: string }> };
    };

    const items = json.result?.data || [];
    const rawItems: RawContentInput[] = items.map((item, i) => ({
      sourceId,
      externalId: item.url?.split('/').pop()?.slice(0, 50) || `${sourceId}-${i}`,
      externalUrl: item.url,
      title: item.title || '',
      content: item.intro,
      sourceRank: undefined,
      rawData: item as unknown as Record<string, unknown>,
      language: 'zh',
    }));

    const valid = rawItems.filter((i) => i.title.length > 3);
    const result = await insertRawContents(valid, sourceId);
    const duration = Date.now() - startTime;

    await writeFetchLog(sourceId, result.newCount > 0 ? 'success' : 'partial', result.total, result.newCount, duration);
    return { success: result.newCount > 0, data: valid, source: sourceId, fetchedAt };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    await writeFetchLog(sourceId, 'failed', 0, 0, duration, errorMsg);
    return { success: false, data: [], source: sourceId, fetchedAt, error: errorMsg };
  }
}
