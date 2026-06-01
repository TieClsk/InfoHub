import { fetchRssSource } from './rss-base';
import type { FetcherResult, RawContentInput } from '@/types';

const CONFIG = {
  sourceId: 'nhk',
  feedUrl: 'https://www3.nhk.or.jp/rss/news/cat0.xml',
  language: 'ja', // NHK 是日语，AI 会翻译为中文
};

export async function fetchNhkNews(): Promise<FetcherResult<RawContentInput>> {
  return fetchRssSource(CONFIG);
}
