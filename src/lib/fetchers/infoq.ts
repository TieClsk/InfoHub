import { fetchRssSource } from './rss-base';
import type { FetcherResult, RawContentInput } from '@/types';

export async function fetchInfoq(): Promise<FetcherResult<RawContentInput>> {
  return fetchRssSource({ sourceId: 'infoq', feedUrl: 'https://www.infoq.cn/feed', language: 'zh' });
}
