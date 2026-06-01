import { fetchRssSource } from './rss-base';
import type { FetcherResult, RawContentInput } from '@/types';

export async function fetchRt(): Promise<FetcherResult<RawContentInput>> {
  return fetchRssSource({ sourceId: 'rt', feedUrl: 'https://www.rt.com/rss/', language: 'en' });
}
