import { fetchWithTimeout, insertRawContents, writeFetchLog } from '@/lib/fetcher-utils';
import type { FetcherResult, RawContentInput } from '@/types';

const SOURCE_ID = 'sina-intl';

export async function fetchSinaIntl(): Promise<FetcherResult<RawContentInput>> {
  const startTime = Date.now();
  const fetchedAt = new Date();

  try {
    const response = await fetchWithTimeout(
      'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2510&k=&num=30&page=1',
      8000
    );
    const json = (await response.json()) as {
      result: { data: Array<{ title: string; url: string; intro: string; ctime: string }> };
    };

    const items = json.result?.data || [];
    const rawItems: RawContentInput[] = items.map((item, i) => ({
      sourceId: SOURCE_ID,
      externalId: item.url?.split('/').pop()?.slice(0, 50) || `si-${i}`,
      externalUrl: item.url,
      title: item.title || '',
      content: item.intro,
      sourceRank: undefined,
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
