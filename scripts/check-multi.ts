import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function main() {
  const items = await p.processedContent.findMany({
    select: { title: true, category: true, metadata: true, sourceName: true, importance: true },
    orderBy: { importance: 'desc' },
    take: 20,
  });

  for (const i of items) {
    try {
      const m = JSON.parse(i.metadata || '{}') as { sourceCount?: number; sourceNames?: string[] };
      const sc = m.sourceCount || 1;
      const flag = sc > 1 ? ' 🔗MULTI' : '';
      console.log(`[${i.category}] sc=${sc} sn=[${(m.sourceNames||[]).join(',')}] ${i.importance.toFixed(1)} ${i.title.slice(0, 40)}${flag}`);
    } catch {
      console.log(`[${i.category}] PARSE_ERR ${i.title.slice(0, 40)}`);
    }
  }

  // Count total multi-source
  const all = await p.processedContent.findMany({ select: { metadata: true } });
  let multi = 0;
  for (const i of all) {
    try {
      const m = JSON.parse(i.metadata || '{}') as { sourceCount?: number };
      if ((m.sourceCount || 1) > 1) multi++;
    } catch { /* skip */ }
  }
  console.log(`\nMulti-source: ${multi}/${all.length}`);

  // Check a domestic item's full metadata
  const dom = await p.processedContent.findFirst({ where: { category: 'domestic' }, select: { metadata: true, title: true } });
  if (dom) console.log('\nSample domestic metadata:', dom.metadata?.slice(0, 300));

  await p.$disconnect();
}

main();
