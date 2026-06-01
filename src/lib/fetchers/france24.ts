import { fetchRssSource } from './rss-base';
import type { FetcherResult, RawContentInput } from '@/types';

export async function fetchFrance24(): Promise<FetcherResult<RawContentInput>> {
  return fetchRssSource({ sourceId: 'france24', feedUrl: 'https://www.france24.com/en/rss', language: 'en' });
}
