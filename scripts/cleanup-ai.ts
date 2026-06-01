import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { processCategory } from '../src/lib/pipeline';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }),
});

async function main() {
  // 列出当前 AI 板块数据
  const before = await prisma.processedContent.findMany({
    where: { category: 'ai' },
    orderBy: { importance: 'desc' },
  });
  console.log(`Current AI items: ${before.length}`);

  // 找出有问题的条目
  for (const item of before) {
    const issues: string[] = [];
    if (item.summary.includes('请提供您需要翻译') || item.summary.includes('好的，请提供')) {
      issues.push('BAD_TRANSLATION');
    }
    if (item.title.includes('歌曲') || item.title.includes('天文') || item.title.includes('音乐')) {
      issues.push('NON_TECH');
    }
    if (item.title.length > 80 && !/ai|模型|代码|编程|数据/i.test(item.title.toLowerCase())) {
      issues.push('LONG_NON_TECH_TITLE');
    }
    if (issues.length > 0) {
      console.log(`  [${issues.join(',')}] ${item.title.slice(0, 60)}`);
    }
  }

  // 清空重处理
  console.log('\nClearing and re-processing...');
  await prisma.processedContent.deleteMany({ where: { category: 'ai' } });

  const result = await processCategory('ai', 30);
  console.log(`Re-processed: ${result.processed}, Errors: ${result.errors.length}`);

  const after = await prisma.processedContent.count({ where: { category: 'ai' } });
  console.log(`New AI count: ${after}`);

  // 检查新数据质量
  const items = await prisma.processedContent.findMany({
    where: { category: 'ai' },
    orderBy: { importance: 'desc' },
  });
  for (const item of items) {
    const ok = !item.summary.includes('请提供') && item.title.length < 100;
    const flag = ok ? '' : ' ⚠️';
    console.log(`  [${item.importance}] ${item.title.slice(0, 60)}${flag}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
