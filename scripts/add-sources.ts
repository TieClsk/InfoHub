import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }),
});

async function main() {
  const sources = [
    {
      name: 'hackernews',
      displayName: 'Hacker News',
      category: 'ai',
      type: 'rss',
      config: JSON.stringify({ feedUrl: 'https://hnrss.org/frontpage?count=30' }),
      schedule: '0 7,13,19 * * *',
    },
    {
      name: 'bbc',
      displayName: 'BBC News',
      category: 'international',
      type: 'rss',
      config: JSON.stringify({ feedUrl: 'https://feeds.bbci.co.uk/news/rss.xml' }),
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
  .then(() => { console.log('Done.'); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
