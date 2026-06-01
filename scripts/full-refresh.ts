import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  fetchRenminNews, fetchSinaNews, fetchSinaSocial, fetchBaiduHot,
  fetchWeiboHot, fetchNhkNews, fetchSinaIntl, fetchSinaMil,
  fetchHackerNews, fetch36kr, fetchInfoq, fetchGithubTrending,
  fetchEastmoneyNews, fetchSinaFinance,
  fetchThepaper, fetchHuanqiu, fetchToutiao, fetchNetease,
  fetchNpr, fetchFrance24, fetchRt,
} from '../src/lib/fetchers';
import { processCategory } from '../src/lib/pipeline';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

type Fetcher = { name: string; fn: () => Promise<{ success: boolean; data: Array<unknown> }> };

const FETCHERS: Fetcher[] = [
  { name: 'renmin', fn: fetchRenminNews }, { name: 'sina', fn: fetchSinaNews },
  { name: 'sina-social', fn: fetchSinaSocial }, { name: 'baidu', fn: fetchBaiduHot },
  { name: 'thepaper', fn: fetchThepaper }, { name: 'toutiao', fn: fetchToutiao },
  { name: 'netease', fn: fetchNetease }, { name: 'weibo', fn: fetchWeiboHot },
  { name: 'nhk', fn: fetchNhkNews }, { name: 'sina-intl', fn: fetchSinaIntl },
  { name: 'sina-mil', fn: fetchSinaMil }, { name: 'huanqiu', fn: fetchHuanqiu },
  { name: 'hackernews', fn: fetchHackerNews }, { name: '36kr', fn: fetch36kr },
  { name: 'infoq', fn: fetchInfoq }, { name: 'github-trending', fn: fetchGithubTrending },
  { name: 'eastmoney', fn: fetchEastmoneyNews }, { name: 'sina-finance', fn: fetchSinaFinance },
  { name: 'npr', fn: fetchNpr }, { name: 'france24', fn: fetchFrance24 }, { name: 'rt', fn: fetchRt },
];

async function fetchOne(f: Fetcher, retries = 2): Promise<number> {
  // 清空旧数据
  await p.rawContent.deleteMany({ where: { sourceId: f.name } });

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const r = await f.fn();
      const count = await p.rawContent.count({ where: { sourceId: f.name } });
      if (count > 0) {
        console.log(`  ✅ ${f.name}: ${count} items`);
        return count;
      }
      if (attempt <= retries) console.log(`  🔄 ${f.name}: 0 items, retry ${attempt}/${retries}...`);
    } catch (e) {
      if (attempt <= retries) console.log(`  🔄 ${f.name}: error, retry ${attempt}/${retries}: ${e instanceof Error ? e.message.slice(0, 50) : ''}`);
    }
  }
  console.log(`  ❌ ${f.name}: FAILED after retries`);
  return 0;
}

async function main() {
  // Phase 1: 采集所有数据（先清空，再采集，失败重试）
  console.log('=== Phase 1: Fetching ===');
  const results: Array<{ name: string; count: number }> = [];
  for (const f of FETCHERS) {
    const count = await fetchOne(f);
    results.push({ name: f.name, count });
  }
  const totalRaw = results.reduce((s, r) => s + r.count, 0);
  console.log(`  Total raw: ${totalRaw}`);

  // Phase 2: AI 处理
  await p.processedContent.deleteMany();
  console.log('\n=== Phase 2: Processing ===');
  for (const cat of ['domestic', 'weibo', 'international', 'ai', 'github', 'investment']) {
    const result = await processCategory(cat, 300);
    const count = await p.processedContent.count({ where: { category: cat } });
    console.log(`  ${cat}: ${count}条`);
  }
  console.log(`\nTOTAL: ${await p.processedContent.count()}`);
  await p.$disconnect();
}

main();
