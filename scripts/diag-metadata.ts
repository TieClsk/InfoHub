import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function main() {
  // 取投资板块的 10 条看 metadata
  const inv = await p.processedContent.findMany({
    where: { category: 'investment' },
    take: 10,
    select: { title: true, sourceName: true, metadata: true },
  });

  console.log('=== Investment metadata ===');
  for (const i of inv) {
    const m = JSON.parse(i.metadata || '{}') as Record<string, unknown>;
    console.log(`sourceName: ${i.sourceName}, sc: ${m['sourceCount']}, sn: ${JSON.stringify(m['sourceNames'])}`);
    console.log(`  title: ${i.title.slice(0, 50)}`);
  }

  // Also check RawContent for investment sources
  console.log('\n=== RawContent investment sourceIds ===');
  const rawSrcs = await p.rawContent.groupBy({ by: ['sourceId'], _count: true });
  for (const s of rawSrcs) {
    // 检查这个 sourceId 属于哪个 category
    const ds = await p.dataSource.findUnique({ where: { name: s.sourceId }, select: { category: true } });
    if (ds?.category === 'investment') console.log(`  ${s.sourceId}: ${s._count} items`);
  }

  await p.$disconnect();
}

main();
