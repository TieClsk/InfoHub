import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  fetchRenminNews, fetchSinaNews, fetchSinaSocial, fetchBaiduHot,
  fetchWeiboHot, fetchNhkNews, fetchSinaIntl, fetchSinaMil,
  fetchHackerNews, fetch36kr, fetchInfoq, fetchGithubTrending,
  fetchEastmoneyNews, fetchSinaFinance,
  fetchThepaper, fetchHuanqiu, fetchToutiao, fetchNetease,
} from '../src/lib/fetchers';
import { processCategory } from '../src/lib/pipeline';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function refetch(name: string, fn: () => Promise<{ success: boolean; data: Array<unknown> }>) {
  // 清空旧数据
  await p.rawContent.deleteMany({ where: { sourceId: name } });
  try {
    const r = await fn();
    const count = await p.rawContent.count({ where: { sourceId: name } });
    console.log(`  ${r.success ? '✅' : '⚠️'} ${name}: ${count} items`);
    return count;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e instanceof Error ? e.message : String(e)}`);
    return 0;
  }
}

async function main() {
  // 1. 全量重采
  console.log('=== Refetching all ===');
  let totalRaw = 0;
  totalRaw += await refetch('renmin', fetchRenminNews);
  totalRaw += await refetch('sina', fetchSinaNews);
  totalRaw += await refetch('sina-social', fetchSinaSocial);
  totalRaw += await refetch('baidu', fetchBaiduHot);
  totalRaw += await refetch('thepaper', fetchThepaper);
  totalRaw += await refetch('toutiao', fetchToutiao);
  totalRaw += await refetch('netease', fetchNetease);
  totalRaw += await refetch('weibo', fetchWeiboHot);
  totalRaw += await refetch('nhk', fetchNhkNews);
  totalRaw += await refetch('sina-intl', fetchSinaIntl);
  totalRaw += await refetch('sina-mil', fetchSinaMil);
  totalRaw += await refetch('huanqiu', fetchHuanqiu);
  totalRaw += await refetch('hackernews', fetchHackerNews);
  totalRaw += await refetch('36kr', fetch36kr);
  totalRaw += await refetch('infoq', fetchInfoq);
  totalRaw += await refetch('github-trending', fetchGithubTrending);
  totalRaw += await refetch('eastmoney', fetchEastmoneyNews);
  totalRaw += await refetch('sina-finance', fetchSinaFinance);
  console.log(`  Total raw: ${totalRaw}`);

  // 2. 重处理
  await p.processedContent.deleteMany();
  console.log('\n=== Processing ===');
  for (const cat of ['domestic', 'weibo', 'international', 'ai', 'github', 'investment']) {
    const result = await processCategory(cat, 300);
    const count = await p.processedContent.count({ where: { category: cat } });
    console.log(`  ${cat}: ${count}条`);
  }
  console.log(`\nTOTAL: ${await p.processedContent.count()}`);
  await p.$disconnect();
}

main();
