import { fetchWithTimeout, insertRawContents, writeFetchLog } from '@/lib/fetcher-utils';
import type { FetcherResult, RawContentInput } from '@/types';

const SOURCE_ID = 'weibo';

export async function fetchWeiboHot(): Promise<FetcherResult<RawContentInput>> {
  const startTime = Date.now();
  const fetchedAt = new Date();

  try {
    const response = await fetch('https://weibo.com/ajax/side/hotSearch', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://weibo.com/',
        'Cookie': 'SUB=_2AkMRJp1Hf8NxqwJRmP0QxWzhaYR_yQzEieKkqNtEJRMxHRl-yT9vqmgNtQs6BfEvehB7NFE0c-ZbS5a3EaY7XfZRv52X;',
      },
      signal: AbortSignal.timeout(8000),
    });
    const json = (await response.json()) as {
      ok: number;
      data: {
        realtime: Array<{
          word_scheme: string;
          word: string;
          rank: number;
          raw_hot: number;
          label_name: string;
        }>;
      };
    };

    if (!json.ok || !json.data?.realtime) {
      throw new Error('Invalid Weibo API response');
    }

    const rawItems: RawContentInput[] = json.data.realtime.map((item, i) => ({
      sourceId: SOURCE_ID,
      externalId: `weibo-${item.word || i}`,
      externalUrl: `https://s.weibo.com/weibo?q=${encodeURIComponent(item.word || '')}`,
      title: item.word_scheme || item.word || '',
      sourceRank: Math.round(item.raw_hot || (100 - item.rank)),
      rawData: item as unknown as Record<string, unknown>,
      language: 'zh',
    }));

    // 过滤空标题
    const valid = rawItems.filter((i) => i.title.length > 2);

    const result = await insertRawContents(valid, SOURCE_ID);
    const duration = Date.now() - startTime;

    await writeFetchLog(
      SOURCE_ID,
      result.errors.length > 0 && result.newCount > 0 ? 'partial' : 'success',
      result.total,
      result.newCount,
      duration,
      result.errors.length > 0 ? result.errors.join('; ') : undefined
    );

    return {
      success: result.newCount > 0,
      data: valid,
      source: SOURCE_ID,
      fetchedAt,
      error: result.errors.length > 0 ? result.errors.join('; ') : undefined,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    await writeFetchLog(SOURCE_ID, 'failed', 0, 0, duration, errorMsg);
    return { success: false, data: [], source: SOURCE_ID, fetchedAt, error: errorMsg };
  }
}
