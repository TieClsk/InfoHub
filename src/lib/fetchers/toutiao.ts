import { fetchWithTimeout, insertRawContents, writeFetchLog } from '@/lib/fetcher-utils';
import type { FetcherResult, RawContentInput } from '@/types';

const SOURCE_ID = 'toutiao';
const API = 'https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc';

export async function fetchToutiao(): Promise<FetcherResult<RawContentInput>> {
  const startTime = Date.now();
  const fetchedAt = new Date();

  try {
    const response = await fetchWithTimeout(API, 8000);
    const json = (await response.json()) as {
      data?: Array<{ Title: string; ClusterId: number; HotValue: number; Url?: string }>;
    };
    const items = json.data || [];

    const rawItems: RawContentInput[] = items.map((item) => ({
      sourceId: SOURCE_ID,
      externalId: String(item.ClusterId),
      externalUrl: item.Url || `https://www.toutiao.com/trending/${item.ClusterId}`,
      title: item.Title || '',
      sourceRank: item.HotValue,
      rawData: item as unknown as Record<string, unknown>,
      language: 'zh',
    }));

    const valid = rawItems.filter((i) => i.title.length > 2);
    const result = await insertRawContents(valid, SOURCE_ID);
    const duration = Date.now() - startTime;
    await writeFetchLog(SOURCE_ID, result.newCount > 0 ? 'success' : 'partial', result.total, result.newCount, duration);
    return { success: result.newCount > 0, data: valid, source: SOURCE_ID, fetchedAt };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    await writeFetchLog(SOURCE_ID, 'failed', 0, 0, duration, errorMsg);
    return { success: false, data: [], source: SOURCE_ID, fetchedAt, error: errorMsg };
  }
}
