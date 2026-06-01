import { fetchRssSource } from './rss-base';
import type { FetcherResult, RawContentInput } from '@/types';

export async function fetch36kr(): Promise<FetcherResult<RawContentInput>> {
  return fetchRssSource({ sourceId: '36kr', feedUrl: 'https://36kr.com/feed', language: 'zh' });
}
