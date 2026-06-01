import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { fetchWeiboHot } from '../src/lib/fetchers/weibo-hot';
import { processCategory } from '../src/lib/pipeline';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }),
});

async function main() {
  // 种子
  await prisma.dataSource.upsert({
    where: { name: 'weibo' },
    create: {
      name: 'weibo', displayName: '微博热搜', category: 'domestic', type: 'rest_api',
      config: JSON.stringify({ url: 'https://weibo.com/ajax/side/hotSearch' }),
      schedule: '0 7,13,19 * * *',
    },
    update: { category: 'domestic' },
  });
  console.log('seed OK');

  // 采集微博
  console.log('\nFetching Weibo...');
  const r = await fetchWeiboHot();
  console.log(`Success: ${r.success}, Items: ${r.data.length}`);
  if (r.data.length) r.data.slice(0, 5).forEach((i) => console.log(`  ${i.title.slice(0, 60)}`));

  // AI 处理国内板块（人民网 + 微博热搜 交叉验证）
  console.log('\nReprocessing domestic with cross-source AI...');
  await prisma.processedContent.deleteMany({ where: { category: 'domestic' } });
  const result = await processCategory('domestic', 50);
  console.log(`Processed: ${result.processed}, Errors: ${result.errors.length}`);

  // 查看交叉验证效果
  const items = await prisma.processedContent.findMany({
    where: { category: 'domestic' },
    orderBy: { importance: 'desc' },
    take: 8,
  });
  console.log('\nTop domestic (cross-source):');
  for (const item of items) {
    let sc = 0;
    let sn: string[] = [];
    try {
      const m = JSON.parse(item.metadata || '{}') as { sourceCount?: number; sourceNames?: string[] };
      sc = m.sourceCount ?? 0;
      sn = m.sourceNames ?? [];
    } catch {}
    const marker = sc > 1 ? ` [${sc}家: ${sn.join(',')}]` : '';
    console.log(`  [${item.importance}] ${item.title.slice(0, 55)}${marker}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
