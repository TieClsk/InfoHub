import { fetchWithTimeout, insertRawContents, writeFetchLog } from '@/lib/fetcher-utils';
import type { FetcherResult, RawContentInput } from '@/types';

const SOURCE_ID = 'hackernews';
// 通过 hnrss 获取 Hacker News 热门（不需要 API key）
const RSS_URL = 'https://hnrss.org/frontpage?count=30';

export async function fetchHackerNews(): Promise<FetcherResult<RawContentInput>> {
  const startTime = Date.now();
  const fetchedAt = new Date();

  try {
    const response = await fetchWithTimeout(RSS_URL);
    const xml = await response.text();

    // 简单 XML 解析（无需额外库）
    const items = parseRssItems(xml);

    const rawItems: RawContentInput[] = items.map((item, i) => ({
      sourceId: SOURCE_ID,
      externalId: item.link || `hn-${i}`,
      externalUrl: item.link,
      title: item.title || '',
      content: item.description,
      sourceRank: item.points ?? undefined,
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

interface RssItem {
  title?: string;
  link?: string;
  description?: string;
  points?: number;
}

function cleanCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1]!;
    const getTag = (tag: string): string | undefined => {
      const m = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
      return m?.[1] ? cleanCdata(m[1]) : undefined;
    };
    items.push({
      title: getTag('title'),
      link: getTag('link'),
      description: getTag('description')?.replace(/<[^>]*>/g, ''),
    });
  }
  return items;
}
