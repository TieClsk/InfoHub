import { fetchRestApiSource } from './rest-api-base';
import type { FetcherResult, RawContentInput } from '@/types';

const SOURCE_ID = 'tianxing';

export async function fetchTianxingNews(): Promise<FetcherResult<RawContentInput>> {
  const apiKey = process.env['TIANXING_API_KEY'];
  if (!apiKey) {
    return {
      success: false,
      data: [],
      source: SOURCE_ID,
      fetchedAt: new Date(),
      error: 'TIANXING_API_KEY not configured',
    };
  }

  return fetchRestApiSource({
    sourceId: SOURCE_ID,
    baseUrl: 'https://apis.tianapi.com',
    endpoint: '/allnews/index',
    params: {
      key: apiKey,
      num: '30',
    },
    itemsPath: 'result.newslist',
    language: 'zh',
    mapItem: (item: Record<string, unknown>) => ({
      sourceId: SOURCE_ID,
      externalId: item['id'] as string,
      externalUrl: item['url'] as string,
      title: (item['title'] as string) || '',
      content: item['description'] as string | undefined,
      sourceRank: undefined,
      rawData: item,
      language: 'zh',
    }),
  });
}
