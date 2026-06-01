import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function main() {
  // 检查每个源的 RawContent 数量
  console.log('=== RawContent by source ===');
  const raw = await p.rawContent.groupBy({ by: ['sourceId'], _count: true });
  raw.sort((a, b) => b._count - a._count);
  for (const r of raw) console.log(`  ${r.sourceId}: ${r._count}`);

  // 检查最近的一次 FetchLog
  console.log('\n=== Latest FetchLog per source ===');
  const sources = await p.dataSource.findMany();
  for (const s of sources) {
    const log = await p.fetchLog.findFirst({
      where: { sourceId: s.name },
      orderBy: { fetchedAt: 'desc' },
    });
    const status = log ? `${log.status} (${log.newCount} new / ${log.total} total, ${log.duration}ms)` : 'NO LOGS';
    console.log(`  ${s.name} (${s.category}): ${status}`);
  }

  // 检查去重问题：RawContent unique 约束
  console.log('\n=== Dedup check: externalUrl duplicates ===');
  const dups = await p.rawContent.groupBy({ by: ['sourceId', 'externalUrl'], _count: true });
  const dupCounts: Record<string, number> = {};
  for (const d of dups) {
    if (d._count > 1) {
      dupCounts[d.sourceId] = (dupCounts[d.sourceId] || 0) + (d._count - 1);
    }
  }
  for (const [src, count] of Object.entries(dupCounts)) {
    if (count > 0) console.log(`  ${src}: ${count} duplicate externalUrls`);
  }

  await p.$disconnect();
}

main();
