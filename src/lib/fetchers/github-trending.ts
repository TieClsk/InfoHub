import { fetchWithTimeout, insertRawContents, writeFetchLog } from '@/lib/fetcher-utils';
import type { FetcherResult, RawContentInput } from '@/types';

const SOURCE_ID = 'github-trending';

// 国内优先走镜像，最后兜底直连
const API_URLS = [
  'https://mirror.ghproxy.com/https://api.github.com/search/repositories?q=stars:%3E500&sort=stars&order=desc&per_page=30',
  'https://api.github.com/search/repositories?q=stars:%3E500&sort=stars&order=desc&per_page=30',
];

interface GithubRepo {
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
}

function parseItems(json: string): GithubRepo[] {
  const data = JSON.parse(json) as { items?: GithubRepo[] };
  return data.items || [];
}

export async function fetchGithubTrending(): Promise<FetcherResult<RawContentInput>> {
  const startTime = Date.now();
  const fetchedAt = new Date();
  const token = process.env['GITHUB_TOKEN'] || '';

  let lastError = '';

  for (const baseUrl of API_URLS) {
    try {
      const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetchWithTimeout(baseUrl, 15000);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.text();
      const repos = parseItems(json);
      if (repos.length === 0) throw new Error('No repos found');

      const rawItems: RawContentInput[] = repos.map((repo) => ({
        sourceId: SOURCE_ID,
        externalId: repo.full_name,
        externalUrl: repo.html_url,
        title: repo.description ? `${repo.full_name}: ${repo.description}` : repo.full_name,
        sourceRank: repo.stargazers_count,
        content: repo.description || undefined,
        rawData: repo as unknown as Record<string, unknown>,
        language: 'en',
      }));

      const result = await insertRawContents(rawItems, SOURCE_ID);
      const duration = Date.now() - startTime;

      await writeFetchLog(
        SOURCE_ID,
        result.errors.length > 0 && result.newCount > 0 ? 'partial' : 'success',
        result.total, result.newCount, duration,
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
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  const duration = Date.now() - startTime;
  await writeFetchLog(SOURCE_ID, 'failed', 0, 0, duration, lastError);
  return { success: false, data: [], source: SOURCE_ID, fetchedAt, error: lastError };
}
