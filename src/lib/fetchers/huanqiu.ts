import { fetchWithTimeout, insertRawContents, writeFetchLog } from '@/lib/fetcher-utils';
import type { FetcherResult, RawContentInput } from '@/types';

const SOURCE_ID = 'huanqiu';
// 环球网 API，每页30条，共3页≈90条
const API = 'https://www.huanqiu.com/api/list?node=channel%2Cnews&offset=0&limit=90';

export async function fetchHuanqiu(): Promise<FetcherResult<RawContentInput>> {
  const startTime = Date.now();
  const fetchedAt = new Date();

  try {
    const response = await fetchWithTimeout(API);
    const json = (await response.json()) as { list?: Array<{ aid: string; title: string; summary: string }> };
    const items = json.list || [];

    const rawItems: RawContentInput[] = items.map((item) => ({
      sourceId: SOURCE_ID,
      externalId: item.aid,
      externalUrl: `https://www.huanqiu.com/article/${item.aid}`,
      title: item.title || '',
      content: item.summary,
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
