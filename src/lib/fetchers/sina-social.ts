import { fetchSinaSource } from './sina-base';
import type { FetcherResult, RawContentInput } from '@/types';

export async function fetchSinaSocial(): Promise<FetcherResult<RawContentInput>> {
  return fetchSinaSource({ sourceId: 'sina-social', lid: '2511' });
}
