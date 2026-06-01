import { NextRequest, NextResponse } from 'next/server';
import {
  fetchGithubTrending, fetchHackerNews, fetchRenminNews, fetchNhkNews,
  fetchEastmoneyNews, fetchWeiboHot, fetchSinaNews, fetch36kr, fetchInfoq,
  fetchSinaIntl, fetchSinaSocial, fetchSinaFinance, fetchSinaMil,
  fetchBaiduHot, fetchThepaper, fetchHuanqiu, fetchToutiao, fetchNetease,
  fetchNpr, fetchFrance24, fetchRt,
} from '@/lib/fetchers';

const CATEGORIES = ['domestic', 'weibo', 'international', 'ai', 'github', 'investment'];

export async function GET(request: NextRequest) {
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

  // 并发采集（21个源同时抓，3秒内完成）
  const fetchResults = await Promise.allSettled(
    fetchers.map(async ({ name, fn }) => {
      const r = await fn();
      return { name, ok: r.success, count: r.data.length };
    })
  );
  for (const r of fetchResults) {
    if (r.status === 'fulfilled') {
      logs.push(`[fetch] ${r.value.name}: ${r.value.ok ? `OK ${r.value.count}` : 'FAIL'}`);
    } else {
      logs.push(`[fetch] ERR: ${r.reason}`);
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
