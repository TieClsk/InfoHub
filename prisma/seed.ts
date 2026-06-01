import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }),
});

async function main() {
  const sources = [
    {
      name: 'weibo',
      displayName: '微博热搜',
      category: 'domestic',
      type: 'scraper',
      config: JSON.stringify({ url: 'https://tophub.today/n/KqndgxeLl9' }),
      schedule: '0 7,13,19 * * *',
    },
    {
      name: 'tianxing',
      displayName: '天行数据',
      category: 'domestic',
      type: 'rest_api',
      config: JSON.stringify({
        baseUrl: 'https://apis.tianapi.com',
        endpoint: '/allnews/index',
        params: { key: process.env['TIANXING_API_KEY'] || '', num: '30' },
      }),
      schedule: '0 7,13,19 * * *',
    },
    {
      name: 'jiqizhixin',
      displayName: '机器之心',
      category: 'ai',
      type: 'rss',
      config: JSON.stringify({ feedUrl: 'https://www.jiqizhixin.com/rss' }),
      schedule: '0 8,14,20 * * *',
    },
    {
      name: 'github-trending',
      displayName: 'GitHub Trending',
      category: 'github',
      type: 'scraper',
      config: JSON.stringify({ url: 'https://github.com/trending' }),
      schedule: '0 7,19 * * *',
    },
  ];

  for (const src of sources) {
    await prisma.dataSource.upsert({
      where: { name: src.name },
      create: src,
      update: { config: src.config, schedule: src.schedule },
    });
    console.log(`✓ ${src.displayName}`);
  }
}

main()
  .then(() => {
    console.log('Seed complete.');
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
