import { fetchSinaSource } from './sina-base';
import type { FetcherResult, RawContentInput } from '@/types';

export async function fetchSinaMil(): Promise<FetcherResult<RawContentInput>> {
  return fetchSinaSource({ sourceId: 'sina-mil', lid: '2514' });
}
