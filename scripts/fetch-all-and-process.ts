import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { fetchSinaNews } from '../src/lib/fetchers/sina-news';
import { fetchWeiboHot } from '../src/lib/fetchers/weibo-hot';
import { fetch36kr } from '../src/lib/fetchers/36kr';
import { fetchInfoq } from '../src/lib/fetchers/infoq';
import { fetchGithubTrending } from '../src/lib/fetchers/github-trending';
import { fetchHackerNews } from '../src/lib/fetchers/hackernews';
import { fetchRenminNews } from '../src/lib/fetchers/renmin';
import { fetchNhkNews } from '../src/lib/fetchers/nhk';
import { fetchEastmoneyNews } from '../src/lib/fetchers/eastmoney';
import { processCategory } from '../src/lib/pipeline';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }),
});

const CATS = ['domestic', 'weibo', 'international', 'ai', 'github', 'investment'];

async function main() {
  // 1. 采集所有源
  const fetchers = [
    { name: 'renmin', fn: fetchRenminNews },
    { name: 'sina', fn: fetchSinaNews },
    { name: 'weibo', fn: fetchWeiboHot },
    { name: 'nhk', fn: fetchNhkNews },
    { name: 'hackernews', fn: fetchHackerNews },
    { name: '36kr', fn: fetch36kr },
    { name: 'infoq', fn: fetchInfoq },
    { name: 'github-trending', fn: fetchGithubTrending },
    { name: 'eastmoney', fn: fetchEastmoneyNews },
  ];

  console.log('=== Fetching ===');
  for (const { name, fn } of fetchers) {
    try {
      const r = await fn();
      console.log(`  ${name}: ${r.success ? 'OK' : 'FAIL'} (${r.data.length} items)`);
    } catch (e) {
      console.log(`  ${name}: ERROR: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 2. 清空 + AI 处理所有板块
  await prisma.processedContent.deleteMany();
  console.log('\n=== Processing ===');

  for (const cat of CATS) {
    const srcs = await prisma.dataSource.findMany({ where: { category: cat }, select: { name: true } });
    const srcNames = srcs.map((s) => s.name).join(', ');
    console.log(`\n${cat} [${srcNames}]:`);

    const result = await processCategory(cat, 60);
    console.log(`  processed=${result.processed}, errors=${result.errors.length}`);

    // 统计跨源
    const items = await prisma.processedContent.findMany({
      where: { category: cat },
      select: { metadata: true },
    });
    let multi = 0;
    for (const item of items) {
      try {
        const m = JSON.parse(item.metadata || '{}') as { sourceCount?: number };
        if ((m.sourceCount ?? 1) > 1) multi++;
      } catch {}
    }
    console.log(`  total=${items.length}, cross-source=${multi}`);
  }

  // 汇总
  console.log('\n=== Final ===');
  for (const cat of CATS) {
    console.log(`  ${cat}: ${await prisma.processedContent.count({ where: { category: cat } })}`);
  }
  console.log(`  TOTAL: ${await prisma.processedContent.count()}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
