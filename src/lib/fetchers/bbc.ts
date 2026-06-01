import { fetchRssSource } from './rss-base';
import type { FetcherResult, RawContentInput } from '@/types';

const CONFIG = {
  sourceId: 'bbc',
  feedUrl: 'https://feeds.bbci.co.uk/news/rss.xml',
  language: 'en',
};

export async function fetchBbcNews(): Promise<FetcherResult<RawContentInput>> {
  return fetchRssSource(CONFIG);
}
