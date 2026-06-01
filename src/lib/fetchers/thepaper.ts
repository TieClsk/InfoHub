import * as cheerio from 'cheerio';
import { fetchWithTimeout, insertRawContents, writeFetchLog } from '@/lib/fetcher-utils';
import type { FetcherResult, RawContentInput } from '@/types';

const SOURCE_ID = 'thepaper';
// 采集多个频道页获得更多新闻
const URLS = [
  'https://www.thepaper.cn/channel_25950', // 时事
  'https://www.thepaper.cn/channel_25951', // 财经
  'https://www.thepaper.cn/channel_25953', // 科技
];

export async function fetchThepaper(): Promise<FetcherResult<RawContentInput>> {
  const startTime = Date.now();
  const fetchedAt = new Date();
  const allItems: RawContentInput[] = [];
  const seen = new Set<string>();
  let totalFetched = 0;
  const errors: string[] = [];

  for (const url of URLS) {
    try {
      const response = await fetchWithTimeout(url);
      const html = await response.text();
      const $ = cheerio.load(html);

      // 频道页新闻列表
      $('a[href*="newsDetail"], h2 a, .news_li a, .newscontent a, a[href*="channel_"]').each((i, el) => {
        const $a = $(el);
        const title = $a.text().trim();
        const href = $a.attr('href') || '';
        if (!title || title.length < 5 || title.length > 200 || seen.has(title.slice(0, 30))) return;
        seen.add(title.slice(0, 30));

        const fullUrl = href.startsWith('http') ? href : `https://www.thepaper.cn${href}`;
        if (!fullUrl.includes('thepaper.cn')) return;

        allItems.push({
          sourceId: SOURCE_ID, externalId: href.split('/').pop()?.slice(0, 50) || `tp-${i}`,
          externalUrl: fullUrl, title, language: 'zh',
        });
      });
      totalFetched++;
    } catch (e) {
      errors.push(`${url}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 补量：如果总量不够，扩大选择器
  if (allItems.length < 50) {
    for (const url of URLS) {
      try {
        const response = await fetchWithTimeout(url);
        const html = await response.text();
        const $ = cheerio.load(html);
        $('a').each((i, el) => {
          const $a = $(el);
          const title = $a.text().trim();
          const href = $a.attr('href') || '';
          if (title.length >= 6 && title.length < 200 && href.includes('thepaper.cn') && !seen.has(title.slice(0, 25))) {
            seen.add(title.slice(0, 25));
            allItems.push({
              sourceId: SOURCE_ID, externalId: `tp-b-${i}`,
              externalUrl: href.startsWith('http') ? href : `https://www.thepaper.cn${href}`,
              title, language: 'zh',
            });
          }
        });
      } catch { /* ignore */ }
    }
  }

  const unique = allItems.filter((item, idx, arr) => arr.findIndex((t) => t.title === item.title) === idx).slice(0, 100);
  const result = await insertRawContents(unique, SOURCE_ID);
  const duration = Date.now() - startTime;

  await writeFetchLog(
    SOURCE_ID,
    errors.length > 0 && result.newCount > 0 ? 'partial' : result.newCount > 0 ? 'success' : 'failed',
    result.total, result.newCount, duration,
    errors.length > 0 ? errors.join('; ') : undefined
  );

  return { success: result.newCount > 0, data: unique, source: SOURCE_ID, fetchedAt, error: errors.length > 0 ? errors.join('; ') : undefined };
}
