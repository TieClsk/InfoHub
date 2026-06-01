import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { fetchThepaper } from '../src/lib/fetchers/thepaper';
import { fetchSinaNews } from '../src/lib/fetchers/sina-news';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function main() {
  await p.rawContent.deleteMany({ where: { sourceId: 'thepaper' } });
  const tp = await fetchThepaper();
  const tpCount = await p.rawContent.count({ where: { sourceId: 'thepaper' } });
  console.log(`thepaper: fetch=${tp.data.length}, db=${tpCount}`);

  await p.rawContent.deleteMany({ where: { sourceId: 'sina' } });
  const sn = await fetchSinaNews();
  const snCount = await p.rawContent.count({ where: { sourceId: 'sina' } });
  console.log(`sina: fetch=${sn.data.length}, db=${snCount}`);

  await p.$disconnect();
}

main();
