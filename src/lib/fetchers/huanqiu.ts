import { fetchWithTimeout, insertRawContents, writeFetchLog } from '@/lib/fetcher-utils';
import type { FetcherResult, RawContentInput } from '@/types';

const SOURCE_ID = 'huanqiu';
const NODES = ['channel%2Cnews', 'channel%2Cworld', 'channel%2Cfinance', 'channel%2Ctech', 'channel%2Cmil'];

export async function fetchHuanqiu(): Promise<FetcherResult<RawContentInput>> {
  const startTime = Date.now();
  const fetchedAt = new Date();
  const allItems: RawContentInput[] = [];
  const seen = new Set<string>();

  for (const node of NODES) {
    for (let offset = 0; offset <= 90; offset += 30) {
      try {
        const url = `https://www.huanqiu.com/api/list?node=${node}&offset=${offset}&limit=30`;
        const response = await fetchWithTimeout(url, 8000);
        const json = (await response.json()) as { list?: Array<{ aid: string; title: string; summary: string }> };
        const items = json.list || [];
        if (items.length === 0) break;

        for (const item of items) {
          if (!item.title || item.title.length < 4 || seen.has(item.aid)) continue;
          seen.add(item.aid);
          allItems.push({
            sourceId: SOURCE_ID, externalId: item.aid,
            externalUrl: `https://www.huanqiu.com/article/${item.aid}`,
            title: item.title, content: item.summary, language: 'zh',
          });
        }
      } catch { break; }
    }
  }

  const result = await insertRawContents(allItems.slice(0, 150), SOURCE_ID);
  const duration = Date.now() - startTime;
  await writeFetchLog(SOURCE_ID, result.newCount > 0 ? 'success' : 'failed', result.total, result.newCount, duration);
  return { success: result.newCount > 0, data: allItems, source: SOURCE_ID, fetchedAt };
}
