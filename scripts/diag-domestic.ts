import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function main() {
  // 1. 检查 RawContent 各来源数量
  console.log('=== RawContent by source ===');
  const rawSrcs = await p.rawContent.groupBy({ by: ['sourceId'], _count: true });
  rawSrcs.sort((a, b) => b._count - a._count);
  for (const s of rawSrcs) console.log(`  ${s.sourceId}: ${s._count}`);

  // 2. 检查 DataSource category 映射
  console.log('\n=== DataSource mapping ===');
  const dss = await p.dataSource.findMany();
  for (const d of dss) console.log(`  ${d.name} → ${d.category} (${d.displayName})`);

  // 3. 检查 ProcessedContent 来源分布
  console.log('\n=== ProcessedContent by sourceName (domestic) ===');
  const pcSrcs = await p.processedContent.groupBy({ by: ['sourceName'], where: { category: 'domestic' }, _count: true });
  pcSrcs.sort((a, b) => b._count - a._count);
  for (const s of pcSrcs) console.log(`  ${s.sourceName}: ${s._count}`);

  // 4. 检查 metadata 中 sourceCount 分布
  console.log('\n=== Domestic cross-source analysis ===');
  const items = await p.processedContent.findMany({ where: { category: 'domestic' }, orderBy: { importance: 'desc' }, take: 10 });
  for (const i of items) {
    let sc = 0, sn: string[] = [], sr = 0;
    try {
      const m = JSON.parse(i.metadata || '{}') as { sourceCount?: number; sourceNames?: string[]; sourceRank?: number };
      sc = m.sourceCount || 1; sn = m.sourceNames || []; sr = m.sourceRank || 0;
    } catch {}
    console.log(`  [${i.importance}] ${i.sourceName} | sc=${sc} sn=[${sn.join(',')}] | ${i.title.slice(0, 50)}`);
  }

  await p.$disconnect();
}

main();
