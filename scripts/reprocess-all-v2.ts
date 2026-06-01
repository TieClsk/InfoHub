import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { processCategory } from '../src/lib/pipeline';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

const CATS = ['domestic', 'weibo', 'international', 'ai', 'github', 'investment'];

async function main() {
  await p.processedContent.deleteMany();
  console.log('Cleared all\n');

  for (const cat of CATS) {
    const srcs = await p.dataSource.findMany({ where: { category: cat }, select: { name: true } });
    const result = await processCategory(cat, 80);

    const bySrc = await p.processedContent.groupBy({ by: ['sourceName'], where: { category: cat }, _count: true });

    let multi = 0;
    const items = await p.processedContent.findMany({ where: { category: cat }, select: { metadata: true } });
    for (const i of items) {
      try {
        const m = JSON.parse(i.metadata || '{}') as { sourceCount?: number };
        if ((m.sourceCount ?? 1) > 1) multi++;
      } catch {}
    }

    console.log(`${cat} [${srcs.map(s=>s.name).join(',')}]: ${items.length}条, cross=${multi}`);
    for (const s of bySrc) console.log(`  ${s.sourceName}: ${s._count}`);
  }

  console.log(`\nTOTAL: ${await p.processedContent.count()}`);
  await p.$disconnect();
}

main();
