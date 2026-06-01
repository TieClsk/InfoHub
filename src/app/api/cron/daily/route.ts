import { NextRequest, NextResponse } from 'next/server';
import {
  fetchGithubTrending, fetchHackerNews, fetchRenminNews, fetchNhkNews,
  fetchEastmoneyNews, fetchWeiboHot, fetchSinaNews, fetch36kr, fetchInfoq,
  fetchSinaIntl, fetchSinaSocial, fetchSinaFinance, fetchSinaMil,
  fetchBaiduHot, fetchThepaper, fetchHuanqiu, fetchToutiao, fetchNetease,
  fetchNpr, fetchFrance24, fetchRt,
} from '@/lib/fetchers';
import { processCategory, cleanupRawContent } from '@/lib/pipeline';

const CATEGORIES = ['domestic', 'weibo', 'international', 'ai', 'github', 'investment'];
const retentionDays = parseInt(process.env['RAW_RETENTION_DAYS'] ?? '14', 10);

// 鉴权
function auth(request: NextRequest): boolean {
  const secret = process.env['CRON_SECRET'];
  if (!secret) return true;
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!auth(request)) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  const logs: string[] = [];
  const start = Date.now();

  // Phase 1: 增量采集（upsert，已有数据自动跳过）
  const fetchers = [
    { name: 'renmin', fn: fetchRenminNews }, { name: 'sina', fn: fetchSinaNews },
    { name: 'sina-social', fn: fetchSinaSocial }, { name: 'baidu', fn: fetchBaiduHot },
    { name: 'thepaper', fn: fetchThepaper }, { name: 'toutiao', fn: fetchToutiao },
    { name: 'netease', fn: fetchNetease }, { name: 'weibo', fn: fetchWeiboHot },
    { name: 'nhk', fn: fetchNhkNews }, { name: 'sina-intl', fn: fetchSinaIntl },
    { name: 'sina-mil', fn: fetchSinaMil }, { name: 'huanqiu', fn: fetchHuanqiu },
    { name: 'npr', fn: fetchNpr }, { name: 'france24', fn: fetchFrance24 },
    { name: 'rt', fn: fetchRt }, { name: 'hackernews', fn: fetchHackerNews },
    { name: '36kr', fn: fetch36kr }, { name: 'infoq', fn: fetchInfoq },
    { name: 'github-trending', fn: fetchGithubTrending },
    { name: 'eastmoney', fn: fetchEastmoneyNews }, { name: 'sina-finance', fn: fetchSinaFinance },
  ];

  for (const { name, fn } of fetchers) {
    try {
      const r = await fn();
      logs.push(`[fetch] ${name}: ${r.success ? `OK ${r.data.length}` : 'FAIL'}`);
    } catch (err) {
      logs.push(`[fetch] ${name}: ERR ${err instanceof Error ? err.message : ''}`);
    }
  }

  // Phase 2: 增量 AI 处理（只处理未处理的 RawContent，已有数据不动）
  for (const cat of CATEGORIES) {
    try {
      const r = await processCategory(cat, 80);
      logs.push(`[process] ${cat}: +${r.processed} new, ${r.skipped} skipped`);
    } catch (err) {
      logs.push(`[process] ${cat}: ERR ${err instanceof Error ? err.message : ''}`);
    }
  }

  // Phase 3: 清理过期原始数据
  try {
    const { deleted } = await cleanupRawContent(retentionDays);
    logs.push(`[cleanup] ${deleted} old records`);
  } catch (err) {
    logs.push(`[cleanup] ERR`);
  }

  // Phase 4: 刷新速览缓存
  try {
    const baseUrl = request.nextUrl.origin;
    await fetch(`${baseUrl}/api/ai/overview`, { method: 'POST' });
    logs.push('[overview] refreshed');
  } catch { /* ignore */ }

  return NextResponse.json({ success: true, logs, duration: Date.now() - start });
}
