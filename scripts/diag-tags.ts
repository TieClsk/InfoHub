import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function main() {
  let noTags = 0, total = 0;
  for (const cat of ['domestic', 'international', 'ai', 'github', 'investment', 'weibo']) {
    const items = await p.processedContent.findMany({ where: { category: cat } });
    for (const i of items) {
      total++;
      try {
        const t = JSON.parse(i.tags || '[]');
        if (!Array.isArray(t) || t.length === 0) {
          noTags++;
          console.log(`NO TAGS [${cat}] ${i.sourceName}: ${i.title.slice(0, 40)}`);
        }
      } catch { noTags++; }
    }
  }
  console.log(`\nNo tags: ${noTags}/${total}`);

  // Also check bad summaries
  let badSum = 0;
  for (const cat of ['domestic', 'international', 'ai', 'github', 'investment', 'weibo']) {
    const items = await p.processedContent.findMany({ where: { category: cat } });
    for (const i of items) {
      if (i.summary.trim() === i.title.trim() || i.summary.trim().length < 15) {
        badSum++;
        console.log(`BAD SUM [${cat}] ${i.sourceName}: ${i.title.slice(0, 40)}`);
      }
    }
  }
  console.log(`Bad summaries: ${badSum}/${total}`);
  await p.$disconnect();
}

main();
