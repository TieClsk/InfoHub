import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function main() {
  for (const name of ['tianxing', 'bbc', 'jiqizhixin', 'cls']) {
    await p.fetchLog.deleteMany({ where: { sourceId: name } });
    await p.rawContent.deleteMany({ where: { sourceId: name } });
    await p.dataSource.deleteMany({ where: { name } });
    console.log('Deleted:', name);
  }
  const remaining = await p.dataSource.findMany();
  console.log('Remaining:', remaining.map((d) => `${d.name}(${d.category})`).join(', '));
  await p.$disconnect();
}

main();
