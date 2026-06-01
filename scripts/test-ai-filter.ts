import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { processCategory } from '../src/lib/pipeline';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }),
});

async function main() {
  // 清空
  const d = await prisma.processedContent.deleteMany({ where: { category: 'ai' } });
  console.log(`Deleted ${d.count} AI items`);

  // 重处理（用 AI filterIrrelevant）
  console.log('\nProcessing with AI filter...');
  const result = await processCategory('ai', 30);
  console.log(`Processed: ${result.processed}, Errors: ${result.errors.length}`);

  const items = await prisma.processedContent.findMany({
    where: { category: 'ai' },
    orderBy: { importance: 'desc' },
  });
  console.log(`\nAI items: ${items.length}`);
  for (const item of items) {
    console.log(`  [${item.importance}] ${item.title}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
