import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { fetchToutiao } from '../src/lib/fetchers/toutiao';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function main() {
  await p.rawContent.deleteMany({ where: { sourceId: 'toutiao' } });
  const before = await p.rawContent.count({ where: { sourceId: 'toutiao' } });
  console.log('Before fetch:', before);

  const r = await fetchToutiao();
  console.log('Fetch result:', r.success, r.data.length, r.error?.slice(0, 100));

  const after = await p.rawContent.count({ where: { sourceId: 'toutiao' } });
  console.log('After fetch:', after);

  // Check one item
  const item = await p.rawContent.findFirst({ where: { sourceId: 'toutiao' } });
  if (item) console.log('Sample:', item.title?.slice(0, 40), '|', item.externalUrl?.slice(0, 50));

  await p.$disconnect();
}

main();
