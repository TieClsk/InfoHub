import * as cheerio from 'cheerio';
import { fetchWithTimeout, insertRawContents, writeFetchLog } from '@/lib/fetcher-utils';
import type { FetcherResult, RawContentInput } from '@/types';

const SOURCE_ID = 'baidu';

export async function fetchBaiduHot(): Promise<FetcherResult<RawContentInput>> {
  const startTime = Date.now();
  const fetchedAt = new Date();

  try {
    const response = await fetchWithTimeout('https://top.baidu.com/board?tab=realtime', 8000);
    const html = await response.text();
    const $ = cheerio.load(html);

    const rawItems: RawContentInput[] = [];

    // 百度热搜：标题在 .c-single-text-ellipsis 或 .title_dIF3B 等元素中
    $('.category-wrap_iQLoo, .item-wrap_2oCLO, [class*="item"]').each((i, el) => {
      const $el = $(el);
      const titleEl = $el.find('.c-single-text-ellipsis, .title_dIF3B, [class*="title"], a');
      const title = titleEl.first().text().trim();
      const hotEl = $el.find('.hot-index_1Bl1a, [class*="hot-index"], [class*="hotIndex"]');
      const hotText = hotEl.first().text().trim();
      const link = $el.find('a').first().attr('href') || '';

      if (!title || title.length < 4 || /^\d+$/.test(title)) return;
      const hot = parseInt(hotText.replace(/\D/g, ''), 10);
      const sourceRank = Number.isNaN(hot) ? undefined : hot;

      rawItems.push({
        sourceId: SOURCE_ID,
        externalId: `baidu-${i}`,
        externalUrl: link,
        title,
        sourceRank,
        rawData: { hot, index: i },
        language: 'zh',
      });
    });

    // fallback: 降级时使用更严格的过滤
    if (rawItems.length < 5) {
      $('a').each((i, el) => {
        const text = $(el).text().trim();
        const href = $(el).attr('href') || '';
        if (text.length > 5 && text.length < 100 && href.includes('baidu.com')) {
          rawItems.push({
            sourceId: SOURCE_ID,
            externalId: `baidu-a-${i}`,
            externalUrl: href.startsWith('http') ? href : `https://top.baidu.com${href}`,
            title: text,
            language: 'zh',
          });
        }
      });
    }

    // 严格过滤无效标题：纯数字、太短、纯符号
    function isValidTitle(t: string): boolean {
      if (t.length < 4) return false;
      if (/^\d+$/.test(t)) return false; // 纯数字
      if (/^[#＃\s]+$/.test(t)) return false; // 纯符号
      if (/^[\d\s.,，。、]+$/.test(t)) return false; // 数字+标点
      return true;
    }

    const unique = rawItems
      .filter((item) => isValidTitle(item.title))
      .filter((item, idx, arr) => arr.findIndex((t) => t.title === item.title) === idx);

    const result = await insertRawContents(unique.slice(0, 30), SOURCE_ID);
    const duration = Date.now() - startTime;

    await writeFetchLog(SOURCE_ID, result.newCount > 0 ? 'success' : 'partial', result.total, result.newCount, duration);

    return { success: result.newCount > 0, data: unique, source: SOURCE_ID, fetchedAt };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    await writeFetchLog(SOURCE_ID, 'failed', 0, 0, duration, errorMsg);
    return { success: false, data: [], source: SOURCE_ID, fetchedAt, error: errorMsg };
  }
}
