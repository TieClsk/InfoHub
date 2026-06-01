import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { processCategory } from '../src/lib/pipeline';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function main() {
  await p.processedContent.deleteMany({ where: { category: 'domestic' } });
  console.log('Cleared domestic');

  const result = await processCategory('domestic', 80);
  console.log(`Processed: ${result.processed}`);

  // 检查来源分布
  const bySrc = await p.processedContent.groupBy({ by: ['sourceName'], where: { category: 'domestic' }, _count: true });
  console.log('\n来源分布:');
  for (const s of bySrc) console.log(`  ${s.sourceName}: ${s._count}`);

  // 检查多源项目
  const items = await p.processedContent.findMany({ where: { category: 'domestic' }, orderBy: { importance: 'desc' }, take: 10 });
  console.log('\nTop 10:');
  for (const i of items) {
    let sc = 0, sn: string[] = [];
    try { const m = JSON.parse(i.metadata || '{}') as { sourceCount?: number; sourceNames?: string[] }; sc = m.sourceCount || 0; sn = m.sourceNames || []; } catch {}
    console.log(`  [${i.importance}] ${i.sourceName} | ${sc}源[${sn.join(',')}] | ${i.title.slice(0, 50)}`);
  }

  console.log(`\nTotal: ${await p.processedContent.count({ where: { category: 'domestic' } })}`);
  await p.$disconnect();
}

main();
