/* eslint-disable */
import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { fetchHackerNews } from '../src/lib/fetchers/hackernews';
import { processCategory } from '../src/lib/pipeline';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }),
});

async function main() {
  // 1. 清理旧 HN 数据
  const d = await prisma.rawContent.deleteMany({ where: { sourceId: 'hackernews' } });
  console.log('Cleaned old HN:', d.count);

  // 2. 采集 Hacker News
  console.log('\nFetching Hacker News...');
  const hn = await fetchHackerNews();
  console.log(`  Success: ${hn.success}, Items: ${hn.data.length}`);

  // 3. AI 处理
  console.log('\nProcessing with DeepSeek...');
  const result = await processCategory('ai', 10);
  console.log(`  Processed: ${result.processed}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`);
  if (result.errors.length) result.errors.forEach((e: string) => console.log('  ERR:', e));

  // 4. 查看结果
  const items = await prisma.processedContent.findMany({
    where: { sourceId: 'hackernews' },
    orderBy: { importance: 'desc' },
    take: 5,
  });
  console.log('\nTop HN results:');
  for (const item of items) {
    console.log(`  [${item.importance}] ${item.title}`);
    console.log(`    Tags: ${item.tags}`);
  }

  // 5. 统计
  const total = await prisma.processedContent.count();
  console.log(`\nTotal ProcessedContent: ${total}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
