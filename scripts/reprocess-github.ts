import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { processCategory } from '../src/lib/pipeline';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }),
});

async function main() {
  // 清空 GitHub 旧数据
  const d = await prisma.processedContent.deleteMany({ where: { category: 'github' } });
  console.log(`Deleted ${d.count} old GitHub items`);

  // 重新处理全部
  console.log('\nProcessing GitHub with improved prompt (no star counts in titles)...');
  const result = await processCategory('github', 20);
  console.log(`Processed: ${result.processed}, Errors: ${result.errors.length}`);
  if (result.errors.length) result.errors.forEach((e: string) => console.log('ERR:', e));

  // 查看结果
  const items = await prisma.processedContent.findMany({
    where: { category: 'github' },
    orderBy: { importance: 'desc' },
  });
  console.log(`\nTotal GitHub items: ${items.length}`);
  for (const item of items.slice(0, 5)) {
    console.log(`  [${item.importance}] ${item.title}`);
    console.log(`    ${item.summary.slice(0, 80)}`);
    console.log(`    Tags: ${item.tags}`);
    // Parse metadata to check sourceRank
    try {
      const m = JSON.parse(item.metadata || '{}') as { sourceRank?: number };
      if (m.sourceRank) console.log(`    Stars: ${m.sourceRank}`);
    } catch { /* ignore */ }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
