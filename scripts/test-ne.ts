import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { fetchNetease } from '../src/lib/fetchers/netease';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function main() {
  await p.rawContent.deleteMany({ where: { sourceId: 'netease' } });
  const r = await fetchNetease();
  const count = await p.rawContent.count({ where: { sourceId: 'netease' } });
  console.log(`Fetched: ${r.data.length}, DB: ${count}`);
  if (r.data.length > 0) r.data.slice(0, 3).forEach((d) => console.log(' ', d.title.slice(0, 50)));
  await p.$disconnect();
}

main();
