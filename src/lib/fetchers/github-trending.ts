import * as cheerio from 'cheerio';
import { fetchWithTimeout, insertRawContents, writeFetchLog } from '@/lib/fetcher-utils';
import type { FetcherResult, RawContentInput } from '@/types';

const SOURCE_ID = 'github-trending';
const URL = 'https://github.com/trending';

interface GithubTrendingItem {
  repoName: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  todayStars: number;
  repoUrl: string;
}

export async function fetchGithubTrending(): Promise<FetcherResult<RawContentInput>> {
  const startTime = Date.now();
  const source = SOURCE_ID;
  const fetchedAt = new Date();

  try {
    const response = await fetchWithTimeout(URL);
    const html = await response.text();
    const $ = cheerio.load(html);

    const items: GithubTrendingItem[] = [];

    $('article.Box-row').each((_, el) => {
      const $el = $(el);
      const $h2 = $el.find('h2');
      const repoName = $h2.text().trim().replace(/\s+/g, '');
      const repoUrl = 'https://github.com' + ($h2.find('a').attr('href') || '');
      const description = $el.find('p').text().trim();
      const $langEl = $el.find('[itemprop="programmingLanguage"]');
      const language = $langEl.length ? $langEl.text().trim() : 'Unknown';
      const starsText = $el.find('a[href$="/stargazers"]').text().trim();
      const forksText = $el.find('a[href$="/forks"]').text().trim();
      const todayStarsText = $el
        .find('span.d-inline-block.float-sm-right')
        .text()
        .trim();

      const stars = parseCount(starsText);
      const forks = parseCount(forksText);
      const todayStars = parseCount(todayStarsText.replace(/stars?\s*today/i, ''));

      if (repoName && repoUrl) {
        items.push({
          repoName,
          description,
          language,
          stars,
          forks,
          todayStars,
          repoUrl,
        });
      }
    });

    const rawItems: RawContentInput[] = items.map((item, index) => ({
      sourceId: SOURCE_ID,
      externalId: item.repoName,
      externalUrl: item.repoUrl,
      title: item.description ? `${item.repoName}: ${item.description}` : item.repoName,
      sourceRank: item.todayStars,
      rawData: item as unknown as Record<string, unknown>,
      language: 'en',
    }));

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
      source,
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
      source,
      fetchedAt,
      error: errorMsg,
    };
  }
}

function parseCount(text: string): number {
  const cleaned = text.replace(/,/g, '').trim();
  if (!cleaned) return 0;
  if (cleaned.endsWith('k')) {
    return Math.round(parseFloat(cleaned.replace('k', '')) * 1000);
  }
  const num = parseInt(cleaned, 10);
  return Number.isNaN(num) ? 0 : num;
}
