import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { processCategory } from '../src/lib/pipeline';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function main() {
  await p.processedContent.deleteMany();
  console.log('Cleared\n');

  for (const cat of ['domestic', 'weibo', 'international', 'ai', 'github', 'investment']) {
    const srcs = await p.dataSource.findMany({ where: { category: cat }, select: { name: true } });
    const result = await processCategory(cat, 120);
    const items = await p.processedContent.findMany({ where: { category: cat }, select: { importance: true, sourceName: true, metadata: true } });

    let multi = 0;
    const bySrc: Record<string, number> = {};
    for (const i of items) {
      bySrc[i.sourceName] = (bySrc[i.sourceName] || 0) + 1;
      try {
        const m = JSON.parse(i.metadata || '{}') as { sourceCount?: number };
        if ((m.sourceCount ?? 1) > 1) multi++;
      } catch {}
    }

    console.log(`${cat} [${srcs.map(s=>s.name).join(',')}]: ${items.length}条, cross-source=${multi}`);
    for (const [name, count] of Object.entries(bySrc)) console.log(`  ${name}: ${count}`);

    // 展示跨源条目
    if (multi > 0) {
      console.log('  Cross-source items:');
      for (const i of items) {
        let sc = 0; let sn: string[] = [];
        try { const m = JSON.parse(i.metadata||'{}') as {sourceCount?:number; sourceNames?:string[]}; sc=m.sourceCount||0; sn=m.sourceNames||[]; } catch {}
        if (sc > 1) console.log(`    [${i.importance}] ${sn.join('+')} | ${i.sourceName}`);
      }
    }
    console.log();
  }

  console.log(`TOTAL: ${await p.processedContent.count()}`);
  await p.$disconnect();
}

main();
