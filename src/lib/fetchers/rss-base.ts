import Parser from 'rss-parser';
import { insertRawContents, writeFetchLog } from '@/lib/fetcher-utils';
import type { FetcherResult, RawContentInput } from '@/types';

type FeedItem = {
  title: string;
  link?: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
  guid?: string;
  creator?: string;
  categories?: string[];
};

export interface RssSourceConfig {
  sourceId: string;
  feedUrl: string;
  language?: string;
}

const parser = new Parser<Record<string, unknown>, FeedItem>();

export async function fetchRssSource(
  config: RssSourceConfig
): Promise<FetcherResult<RawContentInput>> {
  const startTime = Date.now();
  const fetchedAt = new Date();

  try {
    const feed = await parser.parseURL(config.feedUrl);

    const items: RawContentInput[] = feed.items.map((item) => ({
      sourceId: config.sourceId,
      externalId: item.guid || item.link,
      externalUrl: item.link,
      title: item.title || '',
      content: item.contentSnippet || item.content,
      sourceRank: undefined, // RSS 通常无排名，可留空
      rawData: item as unknown as Record<string, unknown>,
      language: config.language ?? 'zh',
      publishedAt: item.pubDate || item.isoDate, // 源端发布时间
    }));

    const result = await insertRawContents(items, config.sourceId);
    const duration = Date.now() - startTime;

    await writeFetchLog(
      config.sourceId,
      result.errors.length > 0 && result.newCount > 0 ? 'partial'
        : result.errors.length === result.total ? 'failed' : 'success',
      result.total,
      result.newCount,
      duration,
      result.errors.length > 0 ? result.errors.join('; ') : undefined
    );

    return {
      success: result.errors.length === 0,
      data: items,
      source: config.sourceId,
      fetchedAt,
      error: result.errors.length > 0 ? result.errors.join('; ') : undefined,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    await writeFetchLog(config.sourceId, 'failed', 0, 0, duration, errorMsg);

    return {
      success: false,
      data: [],
      source: config.sourceId,
      fetchedAt,
      error: errorMsg,
    };
  }
}
