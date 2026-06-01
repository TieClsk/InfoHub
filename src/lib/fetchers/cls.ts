import * as cheerio from 'cheerio';
import { fetchWithTimeout, insertRawContents, writeFetchLog } from '@/lib/fetcher-utils';
import type { FetcherResult, RawContentInput } from '@/types';

const SOURCE_ID = 'cls';
const URL = 'https://www.cls.cn/telegraph';

export async function fetchClsNews(): Promise<FetcherResult<RawContentInput>> {
  const startTime = Date.now();
  const fetchedAt = new Date();

  try {
    const response = await fetchWithTimeout(URL);
    const html = await response.text();
    const $ = cheerio.load(html);

    const rawItems: RawContentInput[] = [];

    // 财联社电报页面：快讯列表在 .telegraph-content-box 或类似的元素中
    $('.telegraph-content-box, .item, [class*="telegraph"]').each((i, el) => {
      const text = $(el).text().trim();
      if (!text || text.length < 10) return;

      // 提取时间（通常格式如 "10:30"）
      const timeMatch = text.match(/(\d{2}:\d{2})/);
      const title = text.replace(/(\d{2}:\d{2})/, '').trim().slice(0, 200);

      if (title.length < 5) return;

      rawItems.push({
        sourceId: SOURCE_ID,
        externalId: `cls-${Date.now()}-${i}`,
        externalUrl: URL,
        title,
        sourceRank: undefined,
        rawData: { fullText: text, index: i },
        language: 'zh',
      });
    });

    // fallback: 如果选择器没匹配到，尝试获取整个 body text
    if (rawItems.length === 0) {
      $('body').find('script,style').remove();
      // 尝试找所有段落
      $('p, div.telegraph-item, div.item-content, .content').each((i, el) => {
        const text = $(el).text().trim();
        if (text.length > 15 && text.length < 300) {
          rawItems.push({
            sourceId: SOURCE_ID,
            externalId: `cls-${Date.now()}-${i}`,
            externalUrl: URL,
            title: text.slice(0, 200),
            language: 'zh',
          });
        }
      });
    }

    const result = await insertRawContents(rawItems, SOURCE_ID);
    const duration = Date.now() - startTime;

    await writeFetchLog(
      SOURCE_ID,
      result.errors.length > 0 && result.newCount > 0 ? 'partial' : 'success',
      result.total,
      result.newCount,
      duration,
      result.errors.length > 0 ? result.errors.join('; ') : undefined
    );

    return {
      success: result.newCount > 0,
      data: rawItems,
      source: SOURCE_ID,
      fetchedAt,
      error: result.errors.length > 0 ? result.errors.join('; ') : undefined,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    await writeFetchLog(SOURCE_ID, 'failed', 0, 0, duration, errorMsg);
    return { success: false, data: [], source: SOURCE_ID, fetchedAt, error: errorMsg };
  }
}
