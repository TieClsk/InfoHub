import { prisma } from '@/lib/db';
import type { RawContentInput, FetchStatus } from '@/types';

const FETCH_TIMEOUT_MS = 10_000;
const FETCHER_TOTAL_TIMEOUT_MS = 60_000;

export function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

export async function fetchWithRetry(
  url: string,
  retries = 3
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res;
    } catch (error) {
      if (i === retries - 1) throw error;
      const delay = Math.pow(2, i) * 1000; // 1s → 2s → 4s
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('unreachable');
}

function toJsonStr(obj: unknown): string | null {
  if (!obj) return null;
  return JSON.stringify(obj);
}

export async function insertRawContents(
  items: RawContentInput[],
  sourceId: string
): Promise<{ total: number; newCount: number; errors: string[] }> {
  let newCount = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      await prisma.rawContent.upsert({
        where: {
          sourceId_externalUrl: {
            sourceId,
            externalUrl: item.externalUrl ?? '',
          },
        },
        create: {
          sourceId,
          externalId: item.externalId,
          externalUrl: item.externalUrl,
          title: item.title,
          content: item.content,
          sourceRank: item.sourceRank,
          rawData: toJsonStr(item.rawData),
          language: item.language ?? 'zh',
          publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
        },
        update: {
          sourceRank: item.sourceRank,
          rawData: toJsonStr(item.rawData),
          title: item.title,
          publishedAt: item.publishedAt ? new Date(item.publishedAt) : undefined,
        },
      });
      newCount++;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Unique constraint')
      ) {
        // 尝试通过 externalId 去重
        try {
          if (item.externalId) {
            await prisma.rawContent.upsert({
              where: {
                sourceId_externalId: { sourceId, externalId: item.externalId },
              },
              create: {
                sourceId,
                externalId: item.externalId,
                externalUrl: item.externalUrl,
                title: item.title,
                content: item.content,
                sourceRank: item.sourceRank,
                rawData: toJsonStr(item.rawData),
                language: item.language ?? 'zh',
                publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
              },
              update: {
                sourceRank: item.sourceRank,
                rawData: toJsonStr(item.rawData),
                title: item.title,
                publishedAt: item.publishedAt ? new Date(item.publishedAt) : undefined,
              },
            });
            newCount++;
          }
        } catch {
          errors.push(`Failed to insert: ${item.title}`);
        }
      } else {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`${item.title}: ${msg}`);
      }
    }
  }

  return { total: items.length, newCount, errors };
}

export async function writeFetchLog(
  sourceId: string,
  status: FetchStatus,
  total: number,
  newCount: number,
  duration: number,
  message?: string
): Promise<void> {
  try {
    await prisma.fetchLog.create({
      data: { sourceId, status, total, newCount, duration, message },
    });
  } catch (error) {
    console.error('[FetchLog] Failed to write log:', error);
  }
}

export { FETCH_TIMEOUT_MS, FETCHER_TOTAL_TIMEOUT_MS };
