import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { clusterByTitle, verifyAndMerge } from '../src/lib/deepseek';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function main() {
  const srcs = await p.dataSource.findMany({ where: { category: 'domestic' } });
  const srcNames = new Map(srcs.map((s) => [s.name, s.displayName]));

  // 取 domestic 全量
  const raw = await p.rawContent.findMany({
    where: { sourceId: { in: srcs.map((s) => s.name) } },
  });

  const titleItems = raw.map((r) => ({
    id: r.id, title: r.title, sourceName: srcNames.get(r.sourceId) || r.sourceId,
  }));

  // 分批聚类
  const allGroups: string[][] = [];
  for (let i = 0; i < titleItems.length; i += 15) {
    const batch = titleItems.slice(i, i + 15);
    const groups = await clusterByTitle(batch);
    allGroups.push(...groups);
  }

  console.log(`Total groups found: ${allGroups.length}`);

  // 检查哪些是跨源的
  let crossCount = 0;
  for (const g of allGroups) {
    const sources = new Set(g.map((id) => titleItems.find((t) => t.id === id)?.sourceName).filter(Boolean));
    if (sources.size >= 2) {
      crossCount++;
      console.log(`\nCROSS-SOURCE [${[...sources].join(', ')}]:`);
      for (const id of g) {
        const t = titleItems.find((t) => t.id === id);
        if (t) console.log(`  [${t.sourceName}] ${t.title.slice(0, 60)}`);
      }
    }
  }

  console.log(`\nCross-source groups: ${crossCount}/${allGroups.length}`);

  await p.$disconnect();
}

main();
