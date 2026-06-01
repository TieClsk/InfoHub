import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  fetchRenminNews, fetchSinaNews, fetchSinaSocial, fetchBaiduHot,
  fetchWeiboHot,
  fetchNhkNews, fetchSinaIntl, fetchSinaMil,
  fetchHackerNews, fetch36kr, fetchInfoq,
  fetchGithubTrending,
  fetchEastmoneyNews, fetchSinaFinance,
  fetchThepaper, fetchHuanqiu, fetchToutiao, fetchNetease,
} from '../src/lib/fetchers';
import { processCategory } from '../src/lib/pipeline';

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

const SOURCES = [
  // 国内（6源）
  { name: 'renmin', display: '人民网', cat: 'domestic' },
  { name: 'sina', display: '新浪新闻', cat: 'domestic' },
  { name: 'sina-social', display: '新浪社会', cat: 'domestic' },
  { name: 'baidu', display: '百度热搜', cat: 'domestic' },
  { name: 'thepaper', display: '澎湃新闻', cat: 'domestic' },
  { name: 'toutiao', display: '今日头条', cat: 'domestic' },
  { name: 'netease', display: '网易新闻', cat: 'domestic' },
  // 微博（1源）
  { name: 'weibo', display: '微博热搜', cat: 'weibo' },
  // 国际（4源）
  { name: 'nhk', display: 'NHK News', cat: 'international' },
  { name: 'sina-intl', display: '新浪国际', cat: 'international' },
  { name: 'sina-mil', display: '新浪军事', cat: 'international' },
  { name: 'huanqiu', display: '环球网', cat: 'international' },
  // AI（3源）
  { name: 'hackernews', display: 'Hacker News', cat: 'ai' },
  { name: '36kr', display: '36氪', cat: 'ai' },
  { name: 'infoq', display: 'InfoQ', cat: 'ai' },
  // GitHub（1源）
  { name: 'github-trending', display: 'GitHub Trending', cat: 'github' },
  // 投资（2源）
  { name: 'eastmoney', display: '东方财富', cat: 'investment' },
  { name: 'sina-finance', display: '新浪财经', cat: 'investment' },
];

const FETCHERS: Record<string, () => Promise<{ success: boolean; data: Array<unknown> }>> = {
  renmin: fetchRenminNews, sina: fetchSinaNews, 'sina-social': fetchSinaSocial,
  weibo: fetchWeiboHot, baidu: fetchBaiduHot, nhk: fetchNhkNews,
  'sina-intl': fetchSinaIntl, 'sina-mil': fetchSinaMil,
  hackernews: fetchHackerNews, '36kr': fetch36kr, infoq: fetchInfoq,
  'github-trending': fetchGithubTrending, eastmoney: fetchEastmoneyNews,
  'sina-finance': fetchSinaFinance,
  thepaper: fetchThepaper, huanqiu: fetchHuanqiu, toutiao: fetchToutiao,
  netease: fetchNetease,
};

async function main() {
  // 1. 种子
  console.log('=== Seeding ===');
  for (const s of SOURCES) {
    await prisma.dataSource.upsert({
      where: { name: s.name },
      create: { name: s.name, displayName: s.display, category: s.cat, type: 'rest_api', config: '{}', schedule: '0 7,13,19 * * *' },
      update: { category: s.cat, displayName: s.display },
    });
    console.log(`  ✓ ${s.display} → ${s.cat}`);
  }

  // 2. 采集
  console.log('\n=== Fetching ===');
  const stats: Array<{ name: string; ok: boolean; count: number }> = [];
  for (const [name, fn] of Object.entries(FETCHERS)) {
    try {
      const r = await fn();
      stats.push({ name, ok: r.success, count: r.data.length });
      console.log(`  ${r.success ? '✅' : '❌'} ${name}: ${r.data.length} items`);
    } catch (e) {
      stats.push({ name, ok: false, count: 0 });
      console.log(`  ❌ ${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const totalRaw = stats.reduce((s, x) => s + x.count, 0);
  const okCount = stats.filter((s) => s.ok).length;
  console.log(`\n  Total: ${okCount}/${stats.length} OK, ${totalRaw} raw items`);

  // 3. 处理
  await prisma.processedContent.deleteMany();
  console.log('\n=== Processing ===');

  const CATS = ['domestic', 'weibo', 'international', 'ai', 'github', 'investment'];
  for (const cat of CATS) {
    const result = await processCategory(cat, 200);
    const items = await prisma.processedContent.count({ where: { category: cat } });

    let multi = 0;
    const all = await prisma.processedContent.findMany({ where: { category: cat }, select: { metadata: true } });
    for (const i of all) {
      try { const m = JSON.parse(i.metadata || '{}') as { sourceCount?: number }; if ((m.sourceCount ?? 1) > 1) multi++; } catch {}
    }
    console.log(`  ${cat}: ${items}条, cross=${multi}`);
  }

  console.log(`\nTOTAL: ${await prisma.processedContent.count()}`);
  await prisma.$disconnect();
}

main();
