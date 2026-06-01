import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { processCategory } from '../src/lib/pipeline';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }),
});

async function main() {
  const before = await prisma.processedContent.count({ where: { category: 'ai' } });
  console.log(`Before: ${before} AI items`);

  // 清空旧的 AI 数据
  const d = await prisma.processedContent.deleteMany({ where: { category: 'ai' } });
  console.log(`Deleted ${d.count}`);

  // 重新处理
  console.log('\nReprocessing AI with improved prompt...');
  const result = await processCategory('ai', 30);
  console.log(`Processed: ${result.processed}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`);
  if (result.errors.length) result.errors.forEach((e: string) => console.log('ERR:', e));

  // 查看结果
  const items = await prisma.processedContent.findMany({
    where: { category: 'ai' },
    orderBy: { importance: 'desc' },
  });
  console.log(`\nAfter: ${items.length} AI items\n`);
  for (const item of items.slice(0, 8)) {
    console.log(`[${item.importance}] ${item.title}`);
    console.log(`  ${item.summary.slice(0, 80)}`);
    console.log(`  Tags: ${item.tags}`);
    console.log();
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
