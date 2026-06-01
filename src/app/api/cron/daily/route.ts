import { NextRequest, NextResponse } from 'next/server';
import {
  fetchGithubTrending, fetchHackerNews, fetchRenminNews, fetchNhkNews,
  fetchEastmoneyNews, fetchWeiboHot, fetchSinaNews, fetch36kr, fetchInfoq,
  fetchSinaIntl, fetchSinaSocial, fetchSinaFinance, fetchSinaMil,
  fetchBaiduHot, fetchThepaper, fetchHuanqiu, fetchToutiao, fetchNetease,
  fetchNpr, fetchFrance24, fetchRt,
} from '@/lib/fetchers';

const CATEGORIES = ['domestic', 'weibo', 'international', 'ai', 'github', 'investment'];

function auth(request: NextRequest): boolean {
  const secret = process.env['CRON_SECRET'];
  if (!secret) return true;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!auth(request)) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  const baseUrl = request.nextUrl.origin;
  const logs: string[] = [];

  // Phase 1: 采集（遍历所有源，upsert 入库）
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
      logs.push(`[fetch] ${name}: ERR`);
    }
  }

  // Phase 2: 触发异步 AI 处理（每个板块独立调用，各自有独立超时）
  for (const cat of CATEGORIES) {
    fetch(`${baseUrl}/api/cron/process?category=${cat}`, {
      method: 'POST',
      headers: { 'authorization': request.headers.get('authorization') || '' },
    }).catch(() => {});
    logs.push(`[process] ${cat}: queued`);
  }

  // Phase 3: 异步清理 + 刷新速览
  fetch(`${baseUrl}/api/cron/cleanup`, {
    method: 'POST',
    headers: { 'authorization': request.headers.get('authorization') || '' },
  }).catch(() => {});

  return NextResponse.json({ success: true, logs });
}
