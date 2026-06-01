import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }),
});

async function main() {
  const sources = [
    {
      name: 'renmin',
      displayName: '人民网',
      category: 'domestic',
      type: 'rss',
      config: JSON.stringify({ feedUrl: 'http://www.people.com.cn/rss/politics.xml' }),
      schedule: '0 7,13,19 * * *',
    },
    {
      name: 'nhk',
      displayName: 'NHK News',
      category: 'international',
      type: 'rss',
      config: JSON.stringify({ feedUrl: 'https://www3.nhk.or.jp/rss/news/cat0.xml' }),
      schedule: '0 7,13,19 * * *',
    },
    {
      name: 'cls',
      displayName: '财联社',
      category: 'investment',
      type: 'scraper',
      config: JSON.stringify({ url: 'https://www.cls.cn/telegraph' }),
      schedule: '0 7,13,19 * * *',
    },
    {
      name: 'hackernews',
      displayName: 'Hacker News',
      category: 'ai',
      type: 'rss',
      config: JSON.stringify({ feedUrl: 'https://hnrss.org/frontpage?count=30' }),
      schedule: '0 7,13,19 * * *',
    },
  ];

  for (const src of sources) {
    await prisma.dataSource.upsert({
      where: { name: src.name },
      create: src,
      update: { config: src.config, category: src.category },
    });
    console.log(`✓ ${src.displayName}`);
  }
  console.log(`\nTotal sources: ${await prisma.dataSource.count()}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
