import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { clusterByTitle } from '../src/lib/deepseek';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function main() {
  // 取 investment 板块的 raw 数据
  const srcs = await p.dataSource.findMany({ where: { category: 'investment' } });
  const srcNames = new Map(srcs.map((s) => [s.name, s.displayName]));

  const raw = await p.rawContent.findMany({
    where: { sourceId: { in: srcs.map((s) => s.name) } },
    take: 40,
  });

  const titleItems = raw.map((r) => ({
    id: r.id,
    title: r.title,
    sourceName: srcNames.get(r.sourceId) || r.sourceId,
  }));

  console.log(`Testing clusterByTitle with ${titleItems.length} items...`);
  console.log('Sample titles:');
  titleItems.slice(0, 8).forEach((t) => console.log(`  [${t.sourceName}] ${t.title.slice(0, 60)}`));

  const groups = await clusterByTitle(titleItems);
  console.log(`\nGroups found: ${groups.length}`);
  for (const g of groups) {
    console.log(`  Group [${g.length}]:`);
    for (const id of g) {
      const item = titleItems.find((t) => t.id === id);
      if (item) console.log(`    [${item.sourceName}] ${item.title.slice(0, 60)}`);
    }
  }

  await p.$disconnect();
}

main();
