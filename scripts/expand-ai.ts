import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { processCategory } from '../src/lib/pipeline';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }),
});

async function main() {
  // 处理 AI 板块更多内容
  const r = await processCategory('ai', 25);
  console.log('AI processed:', r.processed, 'skipped:', r.skipped);

  // 统计
  const aiCount = await prisma.processedContent.count({ where: { category: 'ai' } });
  const ghCount = await prisma.processedContent.count({ where: { category: 'github' } });
  const total = await prisma.processedContent.count();
  console.log(`AI: ${aiCount}, GitHub: ${ghCount}, Total: ${total}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
