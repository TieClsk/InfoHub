import { fetchRssSource } from './rss-base';
import type { FetcherResult, RawContentInput } from '@/types';

export async function fetchNpr(): Promise<FetcherResult<RawContentInput>> {
  return fetchRssSource({ sourceId: 'npr', feedUrl: 'https://feeds.npr.org/1001/rss.xml', language: 'en' });
}
