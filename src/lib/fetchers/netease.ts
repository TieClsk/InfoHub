import { fetchWithTimeout, insertRawContents, writeFetchLog } from '@/lib/fetcher-utils';
import type { FetcherResult, RawContentInput } from '@/types';

const SOURCE_ID = 'netease';
const API = 'https://c.m.163.com/nc/article/headline/T1348647853363/0-80.html';

export async function fetchNetease(): Promise<FetcherResult<RawContentInput>> {
  const startTime = Date.now();
  const fetchedAt = new Date();

  try {
    const response = await fetchWithTimeout(API, 8000);
    const json = (await response.json()) as Record<string, Array<{ docid: string; title: string; digest: string; url: string; source: string }>>;
    const key = Object.keys(json)[0];
    const items = (key ? json[key] : []) || [];

    const rawItems: RawContentInput[] = items.map((item) => ({
      sourceId: SOURCE_ID,
      externalId: item.docid,
      externalUrl: item.url || `https://3g.163.com/news/${item.docid}`,
      title: item.title || '',
      content: item.digest,
      rawData: item as unknown as Record<string, unknown>,
      language: 'zh',
    }));

    const valid = rawItems.filter((i) => i.title.length > 3);
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
