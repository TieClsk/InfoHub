import { fetchWithTimeout, insertRawContents, writeFetchLog } from '@/lib/fetcher-utils';
import type { FetcherResult, RawContentInput } from '@/types';

export interface RestApiSourceConfig {
  sourceId: string;
  baseUrl: string;
  endpoint: string;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  language?: string;
  /** 从 API 响应中提取条目数组的路径，如 'articles' 或 'result.newslist' */
  itemsPath?: string;
  /** 将 API 返回的单条记录映射为 RawContentInput */
  mapItem: (item: Record<string, unknown>) => RawContentInput;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export async function fetchRestApiSource(
  config: RestApiSourceConfig
): Promise<FetcherResult<RawContentInput>> {
  const startTime = Date.now();
  const fetchedAt = new Date();

  try {
    const url = new URL(config.endpoint, config.baseUrl);
    if (config.params) {
      Object.entries(config.params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const response = await fetchWithTimeout(url.toString());
    const json = (await response.json()) as Record<string, unknown>;

    const dataSource = config.itemsPath ? getNestedValue(json, config.itemsPath) : json;
    const rawItems = (Array.isArray(dataSource) ? dataSource : []) as Record<string, unknown>[];

    const items = rawItems.map((item) => {
      const mapped = config.mapItem(item);
      return {
        ...mapped,
        sourceId: config.sourceId,
        language: mapped.language ?? config.language ?? 'zh',
      };
    });

    const result = await insertRawContents(
      items.map((i) => ({
        sourceId: i.sourceId,
        externalId: i.externalId,
        externalUrl: i.externalUrl,
        title: i.title,
        content: i.content,
        sourceRank: i.sourceRank,
        rawData: i.rawData,
        language: i.language,
      })),
      config.sourceId
    );
    const duration = Date.now() - startTime;

    await writeFetchLog(
      config.sourceId,
      result.errors.length > 0 && result.newCount > 0 ? 'partial'
        : result.errors.length === result.total ? 'failed' : 'success',
      result.total,
      result.newCount,
      duration,
      result.errors.length > 0 ? result.errors.join('; ') : undefined
    );

    return {
      success: result.errors.length === 0,
      data: items,
      source: config.sourceId,
      fetchedAt,
      error: result.errors.length > 0 ? result.errors.join('; ') : undefined,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    await writeFetchLog(config.sourceId, 'failed', 0, 0, duration, errorMsg);

    return {
      success: false,
      data: [],
      source: config.sourceId,
      fetchedAt,
      error: errorMsg,
    };
  }
}
