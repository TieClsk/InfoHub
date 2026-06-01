import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { processCategory } from '../src/lib/pipeline';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }),
});

async function main() {
  // 清空旧的 ProcessedContent
  const deleted = await prisma.processedContent.deleteMany();
  console.log(`Deleted ${deleted.count} old ProcessedContent records`);

  // 重新处理 GitHub 板块
  console.log('\nReprocessing GitHub with improved prompt...');
  const result = await processCategory('github', 10);
  console.log(`Processed: ${result.processed}, Errors: ${result.errors.length}`);

  // 查看新结果
  const items = await prisma.processedContent.findMany({
    take: 5,
    orderBy: { importance: 'desc' },
  });
  console.log('\nNew results:');
  for (const item of items) {
    console.log(`  [${item.importance}] ${item.title}`);
    console.log(`    Tags: ${item.tags}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
