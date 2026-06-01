import * as cheerio from 'cheerio';
import { fetchWithTimeout, insertRawContents, writeFetchLog } from '@/lib/fetcher-utils';
import type { FetcherResult, RawContentInput } from '@/types';

const SOURCE_ID = 'netease';
const URLS = [
  'https://news.163.com/rank/',
  'https://news.163.com/domestic/',
  'https://news.163.com/world/',
  'https://news.163.com/tech/',
];

export async function fetchNetease(): Promise<FetcherResult<RawContentInput>> {
  const startTime = Date.now();
  const fetchedAt = new Date();
  const allItems: RawContentInput[] = [];
  const seen = new Set<string>();

  for (const url of URLS) {
    try {
      const response = await fetchWithTimeout(url, 8000);
      const html = await response.text();
      const $ = cheerio.load(html);

      $('a').each((i, el) => {
        const title = $(el).text().trim();
        const href = $(el).attr('href') || '';
        if (title.length < 6 || title.length > 150) return;
        if (!href.includes('163.com') || !href.includes('article')) return;
        if (seen.has(title.slice(0, 25))) return;
        seen.add(title.slice(0, 25));

        allItems.push({
          sourceId: SOURCE_ID,
          externalId: href.split('/').pop()?.replace('.html', '')?.slice(0, 50) || `ne-${i}`,
          externalUrl: href.startsWith('http') ? href : `https:${href}`,
          title, language: 'zh',
        });
      });
    } catch { /* skip */ }
  }

  const unique = allItems.filter((item, idx, arr) => arr.findIndex((t) => t.title === item.title) === idx).slice(0, 120);
  const result = await insertRawContents(unique, SOURCE_ID);
  const duration = Date.now() - startTime;
  await writeFetchLog(SOURCE_ID, result.newCount > 0 ? 'success' : 'failed', result.total, result.newCount, duration);
  return { success: result.newCount > 0, data: unique, source: SOURCE_ID, fetchedAt };
}
