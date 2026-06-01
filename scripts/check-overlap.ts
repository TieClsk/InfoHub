import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function main() {
  // 取各板块不同源的标题，手动检查重叠
  for (const cat of ['investment', 'domestic', 'international']) {
    console.log(`\n=== ${cat} ===`);
    const srcs = await p.dataSource.findMany({ where: { category: cat }, select: { name: true, displayName: true } });

    for (const src of srcs) {
      const items = await p.rawContent.findMany({
        where: { sourceId: src.name },
        take: 5,
        select: { title: true },
      });
      console.log(`  ${src.displayName}:`);
      for (const i of items) console.log(`    ${i.title.slice(0, 60)}`);
    }
  }

  await p.$disconnect();
}

main();
