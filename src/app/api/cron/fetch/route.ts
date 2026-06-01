import { NextResponse } from 'next/server';
import {
  fetchGithubTrending, fetchHackerNews, fetchRenminNews, fetchNhkNews,
  fetchEastmoneyNews, fetchWeiboHot, fetchSinaNews, fetch36kr, fetchInfoq,
  fetchSinaIntl, fetchSinaSocial, fetchSinaFinance, fetchSinaMil,
  fetchBaiduHot, fetchThepaper, fetchHuanqiu, fetchToutiao, fetchNetease,
  fetchNpr, fetchFrance24, fetchRt,
} from '@/lib/fetchers';

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

export async function GET() {
  const logs: string[] = [];

  const results = await Promise.allSettled(
    fetchers.map(async ({ name, fn }) => {
      const r = await fn();
      return { name, ok: r.success, count: r.data.length };
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled') {
      logs.push(`[fetch] ${r.value.name}: ${r.value.ok ? `OK ${r.value.count}` : 'FAIL'}`);
    }
  }

  return NextResponse.json({ success: true, logs });
}
