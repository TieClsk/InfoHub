import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function main() {
  let bad = 0, total = 0;
  for (const cat of ['domestic', 'international', 'ai', 'github', 'investment', 'weibo']) {
    const items = await p.processedContent.findMany({
      where: { category: cat },
      select: { title: true, summary: true },
    });
    for (const i of items) {
      total++;
      const same = i.summary.trim() === i.title.trim();
      const short = i.summary.trim().length < 15;
      const hasUrl = /https?:\/\//.test(i.summary);
      if (same || short || hasUrl) {
        bad++;
        console.log(`  BAD [${cat}]: ${i.title.slice(0, 30)} | ${i.summary.slice(0, 50)}`);
      }
    }
  }
  console.log(`\nBad summaries: ${bad} / ${total}`);
  await p.$disconnect();
}

main();
