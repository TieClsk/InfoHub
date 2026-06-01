import { fetchRssSource } from './rss-base';
import type { FetcherResult, RawContentInput } from '@/types';

const CONFIG = {
  sourceId: 'jiqizhixin',
  feedUrl: 'https://www.jiqizhixin.com/rss',
  language: 'zh',
};

export async function fetchJiqizhixin(): Promise<FetcherResult<RawContentInput>> {
  return fetchRssSource(CONFIG);
}
