import { fetchSinaSource } from './sina-base';
import type { FetcherResult, RawContentInput } from '@/types';

export async function fetchSinaFinance(): Promise<FetcherResult<RawContentInput>> {
  return fetchSinaSource({ sourceId: 'sina-finance', lid: '2516' });
}
