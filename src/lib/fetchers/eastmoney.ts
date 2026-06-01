import * as cheerio from 'cheerio';
import { fetchWithTimeout, insertRawContents, writeFetchLog } from '@/lib/fetcher-utils';
import type { FetcherResult, RawContentInput } from '@/types';

const SOURCE_ID = 'eastmoney';
const URL = 'https://finance.eastmoney.com/a/czqyw.html';

export async function fetchEastmoneyNews(): Promise<FetcherResult<RawContentInput>> {
  const startTime = Date.now();
  const fetchedAt = new Date();

  try {
    const response = await fetchWithTimeout(URL);
    const html = await response.text();
    const $ = cheerio.load(html);

    const rawItems: RawContentInput[] = [];

    // 东方财富新闻列表：查找所有链接
    $('a').each((i, el) => {
      const $a = $(el);
      const href = $a.attr('href') || '';
      const title = $a.text().trim();

      // 过滤：只保留看起来像新闻标题的链接（长度适中，有实际内容的 href）
      if (title.length < 10 || title.length > 200) return;
      if (!href.includes('finance.eastmoney.com') && !href.startsWith('/a/')) return;

      const url = href.startsWith('http') ? href : `https://finance.eastmoney.com${href}`;

      rawItems.push({
        sourceId: SOURCE_ID,
        externalId: url.split('/').pop()?.slice(0, 50) || `em-${i}`,
        externalUrl: url,
        title,
        sourceRank: undefined,
        rawData: { url, index: i },
        language: 'zh',
      });
    });

    // 去重
    const seen = new Set<string>();
    const unique = rawItems.filter((item) => {
      const key = item.title.slice(0, 30);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const result = await insertRawContents(unique.slice(0, 30), SOURCE_ID);
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
      data: unique,
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
