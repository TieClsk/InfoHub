import * as cheerio from 'cheerio';
import { fetchWithTimeout, insertRawContents, writeFetchLog } from '@/lib/fetcher-utils';
import type { FetcherResult, RawContentInput } from '@/types';

const SOURCE_ID = 'thepaper';
const URL = 'https://www.thepaper.cn/';

export async function fetchThepaper(): Promise<FetcherResult<RawContentInput>> {
  const startTime = Date.now();
  const fetchedAt = new Date();

  try {
    const response = await fetchWithTimeout(URL);
    const html = await response.text();
    const $ = cheerio.load(html);

    const rawItems: RawContentInput[] = [];
    const seen = new Set<string>();

    // 澎湃首页新闻卡片
    $('a[href*="newsDetail"], h2 a, .news_li a, [class*="card"] a[href*="newsDetail"]').each((i, el) => {
      const $a = $(el);
      const title = $a.text().trim();
      const href = $a.attr('href') || '';
      if (!title || title.length < 5 || title.length > 200 || seen.has(title.slice(0, 30))) return;
      seen.add(title.slice(0, 30));

      const url = href.startsWith('http') ? href : `https://www.thepaper.cn${href}`;
      rawItems.push({ sourceId: SOURCE_ID, externalId: href.split('/').pop()?.slice(0, 50) || `tp-${i}`, externalUrl: url, title, language: 'zh' });
    });

    // 补量：扩大选择器捕获更多新闻链接
    if (rawItems.length < 80) {
      $('a').each((i, el) => {
        const $a = $(el);
        const title = $a.text().trim();
        const href = $a.attr('href') || '';
        if (title.length >= 6 && title.length < 200 && (href.includes('thepaper.cn') || href.startsWith('/')) && !seen.has(title.slice(0, 25))) {
          seen.add(title.slice(0, 30));
          rawItems.push({ sourceId: SOURCE_ID, externalId: `tp-a-${i}`, externalUrl: href.startsWith('http') ? href : `https://www.thepaper.cn${href}`, title, language: 'zh' });
        }
      });
    }

    const unique = rawItems.filter((item, idx, arr) => arr.findIndex((t) => t.title === item.title) === idx).slice(0, 80);

    const result = await insertRawContents(unique, SOURCE_ID);
    const duration = Date.now() - startTime;
    await writeFetchLog(SOURCE_ID, result.newCount > 0 ? 'success' : 'partial', result.total, result.newCount, duration);
    return { success: result.newCount > 0, data: unique, source: SOURCE_ID, fetchedAt };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    await writeFetchLog(SOURCE_ID, 'failed', 0, 0, duration, errorMsg);
    return { success: false, data: [], source: SOURCE_ID, fetchedAt, error: errorMsg };
  }
}
