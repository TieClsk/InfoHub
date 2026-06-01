import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function main() {
  for (const src of ['toutiao', 'netease', 'thepaper', 'eastmoney']) {
    const count = await p.rawContent.count({ where: { sourceId: src } });
    const log = await p.fetchLog.findFirst({ where: { sourceId: src }, orderBy: { fetchedAt: 'desc' } });
    const samples = await p.rawContent.findMany({ where: { sourceId: src }, take: 2, select: { title: true, externalId: true } });
    console.log(`${src}: raw=${count} | lastLog=${log?.status} ${log?.newCount}/${log?.total} | samples:`);
    for (const s of samples) console.log(`  ${s.externalId?.slice(0,20)} | ${s.title?.slice(0, 50)}`);
  }

  // Also check processed counts
  console.log('\nProcessed counts:');
  for (const src of ['toutiao', 'netease', 'thepaper', 'eastmoney']) {
    const ds = await p.dataSource.findUnique({ where: { name: src } });
    const cat = ds?.category || 'unknown';
    const count = await p.processedContent.count({ where: { sourceId: src } });
    console.log(`  ${src} (${cat}): ${count} processed`);
  }

  await p.$disconnect();
}

main();
