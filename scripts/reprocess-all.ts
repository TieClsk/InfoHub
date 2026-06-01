import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { processCategory } from '../src/lib/pipeline';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }),
});

const CATS = ['domestic', 'international', 'ai', 'github', 'investment'];

async function main() {
  // 清空所有 AI 数据
  await prisma.processedContent.deleteMany();
  console.log('Cleared all ProcessedContent\n');

  for (const cat of CATS) {
    // 取原始数据中的来源
    const rawSources = await prisma.rawContent.findMany({
      where: {
        sourceId: {
          in: await prisma.dataSource.findMany({
            where: { category: cat },
            select: { name: true },
          }).then((ds) => ds.map((d) => d.name)),
        },
      },
      select: { sourceId: true },
      distinct: ['sourceId'],
    });
    const srcNames = rawSources.map((r) => r.sourceId);
    console.log(`${cat}: sources=[${srcNames.join(', ')}]`);

    const result = await processCategory(cat, 50);
    console.log(`  → ${result.processed} processed, ${result.errors.length} errors`);

    // 统计跨源
    const items = await prisma.processedContent.findMany({
      where: { category: cat },
      select: { metadata: true },
    });
    let multiSource = 0;
    for (const item of items) {
      try {
        const m = JSON.parse(item.metadata || '{}') as { sourceCount?: number };
        if ((m.sourceCount ?? 1) > 1) multiSource++;
      } catch {}
    }
    console.log(`  → ${multiSource}/${items.length} cross-source merged\n`);
  }

  // 汇总
  console.log('=== Final ===');
  for (const cat of CATS) {
    const count = await prisma.processedContent.count({ where: { category: cat } });
    console.log(`  ${cat}: ${count}`);
  }
  console.log(`  TOTAL: ${await prisma.processedContent.count()}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
