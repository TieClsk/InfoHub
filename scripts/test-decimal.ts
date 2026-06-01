import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { processCategory } from '../src/lib/pipeline';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function main() {
  await p.processedContent.deleteMany({ where: { category: 'investment' } });
  await processCategory('investment', 80);
  const items = await p.processedContent.findMany({
    where: { category: 'investment' },
    orderBy: { importance: 'desc' },
    take: 8,
  });
  console.log('Investment scores:');
  for (const i of items) console.log(`  ${i.importance.toFixed(1)} | ${i.title.slice(0, 50)}`);

  await p.$disconnect();
}

main();
