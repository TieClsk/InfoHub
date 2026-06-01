import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { processCategory } from '../src/lib/pipeline';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function main() {
  await p.processedContent.deleteMany({ where: { category: 'investment' } });
  console.log('Reprocessing investment...');
  await processCategory('investment', 80);

  // Check summary quality
  const items = await p.processedContent.findMany({ where: { category: 'investment' }, orderBy: { importance: 'desc' } });
  let badCount = 0;
  console.log(`\n${items.length} items:`);
  for (const i of items.slice(0, 8)) {
    const same = i.summary.trim() === i.title.trim();
    const short = i.summary.trim().length < 15;
    const hasUrl = /https?:\/\//.test(i.summary);
    const ok = !same && !short && !hasUrl;
    if (!ok) badCount++;
    console.log(`  ${ok ? '✅' : '❌'} [${i.importance}] ${i.sourceName} | ${i.title.slice(0, 40)}`);
    if (!ok) console.log(`       summary: ${i.summary.slice(0, 60)}`);
  }
  console.log(`\nBad summaries: ${badCount}/${items.length}`);
  await p.$disconnect();
}

main();
