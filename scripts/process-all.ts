import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { processCategory } from '../src/lib/pipeline';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }),
});

const CATEGORIES = [
  { key: 'domestic', label: '国内热点' },
  { key: 'international', label: '国际热点' },
  { key: 'investment', label: '投资资讯' },
];

async function main() {
  console.log('Current DB state:');
  const gh = await prisma.processedContent.count({ where: { category: 'github' } });
  const ai = await prisma.processedContent.count({ where: { category: 'ai' } });
  console.log(`  GitHub: ${gh}, AI: ${ai}`);

  for (const { key, label } of CATEGORIES) {
    const before = await prisma.processedContent.count({ where: { category: key } });
    console.log(`\n=== ${label} (${key}) ===`);
    console.log(`Before: ${before}`);

    // 清空旧的
    if (before > 0) await prisma.processedContent.deleteMany({ where: { category: key } });

    // AI 处理
    const result = await processCategory(key, 40);
    console.log(`Processed: ${result.processed}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`);
    if (result.errors.length > 0) result.errors.forEach((e) => console.log(`  ERR: ${e}`));

    const after = await prisma.processedContent.count({ where: { category: key } });
    console.log(`After: ${after}`);

    // 预览
    const items = await prisma.processedContent.findMany({
      where: { category: key },
      orderBy: { importance: 'desc' },
      take: 3,
    });
    for (const item of items) {
      console.log(`  [${item.importance}] ${item.title.slice(0, 60)}`);
    }
  }

  // 汇总
  const total = await prisma.processedContent.count();
  const byCat = await Promise.all(
    ['domestic', 'international', 'ai', 'github', 'investment'].map(async (c) => ({
      cat: c, count: await prisma.processedContent.count({ where: { category: c } }),
    }))
  );
  console.log('\n=== 汇总 ===');
  byCat.forEach(({ cat, count }) => console.log(`  ${cat}: ${count}`));
  console.log(`  TOTAL: ${total}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
