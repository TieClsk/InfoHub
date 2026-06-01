import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { fetchSinaIntl } from '../src/lib/fetchers/sina-intl';
import { processCategory } from '../src/lib/pipeline';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function main() {
  await p.dataSource.upsert({
    where: { name: 'sina-intl' },
    create: {
      name: 'sina-intl', displayName: '新浪国际', category: 'international', type: 'rest_api',
      config: JSON.stringify({ feedUrl: 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2510&num=30' }),
      schedule: '0 7,13,19 * * *',
    },
    update: {},
  });
  console.log('seed OK');

  const r = await fetchSinaIntl();
  console.log(`Fetch: ${r.success}, ${r.data.length} items`);

  await p.processedContent.deleteMany({ where: { category: 'international' } });
  const pr = await processCategory('international', 60);
  console.log(`Processed: ${pr.processed}`);

  const items = await p.processedContent.findMany({
    where: { category: 'international' },
    orderBy: { importance: 'desc' },
    take: 8,
  });
  console.log('\nTop international:');
  for (const item of items) {
    let sc = 0;
    try { const m = JSON.parse(item.metadata || '{}') as { sourceCount?: number }; sc = m.sourceCount || 0; } catch {}
    console.log(`  [${item.importance}] ${item.title.slice(0, 60)}${sc > 1 ? ' [' + sc + '家]' : ''}`);
  }
  console.log(`\nTotal ProcessedContent: ${await p.processedContent.count()}`);
}

main().catch(console.error).finally(() => p.$disconnect());
