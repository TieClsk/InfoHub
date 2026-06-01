import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  fetchSinaNews, fetchSinaSocial, fetchSinaIntl, fetchSinaMil, fetchSinaFinance,
  fetchWeiboHot, fetchBaiduHot, fetch36kr, fetchInfoq, fetchHackerNews,
  fetchGithubTrending, fetchRenminNews, fetchNhkNews, fetchEastmoneyNews,
} from '../src/lib/fetchers';
import { processCategory } from '../src/lib/pipeline';

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

const SOURCES = [
  // 国内（4源）：时政 + 综合 + 社会 + 热搜
  { name: 'renmin', display: '人民网', cat: 'domestic', type: 'rss' },
  { name: 'sina', display: '新浪新闻', cat: 'domestic', type: 'rest_api' },
  { name: 'sina-social', display: '新浪社会', cat: 'domestic', type: 'rest_api' },
  { name: 'baidu', display: '百度热搜', cat: 'domestic', type: 'scraper' },
  // 微博（独立）
  { name: 'weibo', display: '微博热搜', cat: 'weibo', type: 'rest_api' },
  // 国际（3源）
  { name: 'nhk', display: 'NHK News', cat: 'international', type: 'rss' },
  { name: 'sina-intl', display: '新浪国际', cat: 'international', type: 'rest_api' },
  { name: 'sina-mil', display: '新浪军事', cat: 'international', type: 'rest_api' },
  // AI/科技（4源）
  { name: 'hackernews', display: 'Hacker News', cat: 'ai', type: 'rss' },
  { name: '36kr', display: '36氪', cat: 'ai', type: 'rss' },
  { name: 'infoq', display: 'InfoQ', cat: 'ai', type: 'rss' },
  // GitHub
  { name: 'github-trending', display: 'GitHub Trending', cat: 'github', type: 'scraper' },
  // 投资（2源）
  { name: 'eastmoney', display: '东方财富', cat: 'investment', type: 'scraper' },
  { name: 'sina-finance', display: '新浪财经', cat: 'investment', type: 'rest_api' },
];

const FETCHERS: Record<string, () => Promise<{ success: boolean; data: Array<unknown> }>> = {
  renmin: fetchRenminNews, sina: fetchSinaNews, 'sina-social': fetchSinaSocial,
  weibo: fetchWeiboHot, baidu: fetchBaiduHot, nhk: fetchNhkNews,
  'sina-intl': fetchSinaIntl, 'sina-mil': fetchSinaMil,
  hackernews: fetchHackerNews, '36kr': fetch36kr, infoq: fetchInfoq,
  'github-trending': fetchGithubTrending, eastmoney: fetchEastmoneyNews,
  'sina-finance': fetchSinaFinance,
};

async function main() {
  // 1. 种子
  console.log('=== Seeding ===');
  for (const s of SOURCES) {
    await prisma.dataSource.upsert({
      where: { name: s.name },
      create: { name: s.name, displayName: s.display, category: s.cat, type: s.type, config: '{}', schedule: '0 7,13,19 * * *' },
      update: { category: s.cat, displayName: s.display },
    });
    console.log(`  ✓ ${s.display} → ${s.cat}`);
  }

  // 2. 采集
  console.log('\n=== Fetching ===');
  for (const [name, fn] of Object.entries(FETCHERS)) {
    try {
      const r = await fn();
      console.log(`  ${name}: ${r.success ? 'OK' : 'FAIL'} (${r.data.length} items)`);
    } catch (e) {
      console.log(`  ${name}: ERROR ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 3. 清空重处理
  await prisma.processedContent.deleteMany();
  console.log('\n=== Processing ===');

  const CATS = ['domestic', 'weibo', 'international', 'ai', 'github', 'investment'];
  for (const cat of CATS) {
    const srcs = await prisma.dataSource.findMany({ where: { category: cat }, select: { name: true } });
    const names = srcs.map((s) => s.name).join(', ');
    const result = await processCategory(cat, 80);
    const items = await prisma.processedContent.count({ where: { category: cat } });
    let multi = 0;
    const all = await prisma.processedContent.findMany({ where: { category: cat }, select: { metadata: true } });
    for (const item of all) {
      try {
        const m = JSON.parse(item.metadata || '{}') as { sourceCount?: number };
        if ((m.sourceCount ?? 1) > 1) multi++;
      } catch {}
    }
    console.log(`  ${cat} [${names}]: ${items}条, cross-source=${multi}`);
  }

  console.log(`\n=== TOTAL: ${await prisma.processedContent.count()} ===`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
