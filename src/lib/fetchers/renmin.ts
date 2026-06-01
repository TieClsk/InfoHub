import { fetchRssSource } from './rss-base';
import type { FetcherResult, RawContentInput } from '@/types';

const CONFIG = {
  sourceId: 'renmin',
  feedUrl: 'http://www.people.com.cn/rss/politics.xml',
  language: 'zh',
};

export async function fetchRenminNews(): Promise<FetcherResult<RawContentInput>> {
  return fetchRssSource(CONFIG);
}
