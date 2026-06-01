import * as cheerio from 'cheerio';
import { fetchWithTimeout, insertRawContents, writeFetchLog } from '@/lib/fetcher-utils';
import type { FetcherResult, RawContentInput } from '@/types';

const SOURCE_ID = 'weibo';
// 使用第三方热榜接口获取微博热搜
const URL = 'https://tophub.today/n/KqndgxeLl9';

export async function fetchWeiboHotsearch(): Promise<FetcherResult<RawContentInput>> {
  const startTime = Date.now();
  const fetchedAt = new Date();

  try {
    const response = await fetchWithTimeout(URL);
    const html = await response.text();
    const $ = cheerio.load(html);

    const rawItems: RawContentInput[] = [];

    // tophub 页面结构：表格行，每行包含排名、标题、热度
    $('table tbody tr').each((index, el) => {
      const $tds = $(el).find('td');
      if ($tds.length < 2) return;

      const rankText = $tds.eq(0).text().trim();
      const titleEl = $tds.eq(1).find('a');
      const title = titleEl.text().trim();
      const url = titleEl.attr('href') || '';
      const heatText = $tds.eq(2).text().trim();

      if (!title) return;

      const rank = parseInt(rankText, 10);
      // 排名越小越热门，转为正向值（排名第一 = 最高分）
      const sourceRank = Number.isNaN(rank) ? undefined : 100 - rank;

      rawItems.push({
        sourceId: SOURCE_ID,
        externalId: `weibo-${rank}`,
        externalUrl: url,
        title,
        sourceRank,
        rawData: { rank, title, url, heat: heatText },
        language: 'zh',
      });
    });

    const result = await insertRawContents(rawItems, SOURCE_ID);
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
      success: result.errors.length === 0,
      data: rawItems,
      source: SOURCE_ID,
      fetchedAt,
      error: result.errors.length > 0 ? result.errors.join('; ') : undefined,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    await writeFetchLog(SOURCE_ID, 'failed', 0, 0, duration, errorMsg);

    return {
      success: false,
      data: [],
      source: SOURCE_ID,
      fetchedAt,
      error: errorMsg,
    };
  }
}
