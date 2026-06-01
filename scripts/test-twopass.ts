import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { processCategory } from '../src/lib/pipeline';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function main() {
  await p.processedContent.deleteMany();
  console.log('Cleared\n');

  for (const cat of ['investment', 'domestic']) {
    const srcs = await p.dataSource.findMany({ where: { category: cat }, select: { name: true } });
    console.log(`${cat} [${srcs.map(s=>s.name).join(',')}]:`);

    const result = await processCategory(cat, 80);

    // 按评分排序展示
    const items = await p.processedContent.findMany({
      where: { category: cat },
      orderBy: { importance: 'desc' },
      take: 12,
    });

    console.log(`  Total: ${await p.processedContent.count({ where: { category: cat } })}`);

    for (const i of items) {
      let sc = 0, sn: string[] = [];
      try { const m = JSON.parse(i.metadata||'{}') as {sourceCount?:number; sourceNames?:string[]}; sc=m.sourceCount||0; sn=m.sourceNames||[]; } catch {}
      const marker = sc > 1 ? ` 🔗${sc}源[${sn.join(',')}]` : '';
      console.log(`  [${i.importance}] ${i.sourceName}${marker} | ${i.title.slice(0,50)}`);
    }
    console.log();
  }

  await p.$disconnect();
}

main();
