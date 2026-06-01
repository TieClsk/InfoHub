import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function main() {
  // 检查现状
  const ds = await p.dataSource.findMany({ where: { category: 'international' } });
  console.log('Current international sources:', ds.map((d) => d.name).join(', '));

  // 补充缺失的三源
  for (const s of [
    { name: 'npr', displayName: 'NPR', category: 'international', type: 'rss', config: '{}', schedule: '0 7,13,19 * * *' },
    { name: 'france24', displayName: 'France24', category: 'international', type: 'rss', config: '{}', schedule: '0 7,13,19 * * *' },
    { name: 'rt', displayName: 'RT News', category: 'international', type: 'rss', config: '{}', schedule: '0 7,13,19 * * *' },
  ]) {
    await p.dataSource.upsert({ where: { name: s.name }, create: s, update: s });
    console.log('  upserted:', s.name);
  }

  // 验证
  const after = await p.dataSource.findMany({ where: { category: 'international' } });
  console.log('After:', after.map((d) => d.name).join(', '));
  await p.$disconnect();
}

main();
