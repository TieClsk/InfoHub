import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }),
});

async function main() {
  const rCount = await prisma.rawContent.count();
  const pCount = await prisma.processedContent.count();
  console.log('RawContent:', rCount);
  console.log('ProcessedContent:', pCount);

  const items = await prisma.processedContent.findMany({
    take: 5,
    orderBy: { importance: 'desc' },
  });
  for (const i of items) {
    console.log(`  [${i.importance}] ${i.title.slice(0, 60)} | ${i.sourceName}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
