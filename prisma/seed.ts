import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }),
});

async function main() {
  const sources = [
    // 热点 / 国内
    { name: 'renmin', displayName: '人民网', category: 'domestic', type: 'rss', config: JSON.stringify({ feedUrl: 'http://www.people.com.cn/rss/politics.xml' }) },
    { name: 'weibo', displayName: '微博热搜', category: 'weibo', type: 'scraper', config: JSON.stringify({}) },
    { name: 'sina', displayName: '新浪新闻', category: 'domestic', type: 'rest_api', config: JSON.stringify({}) },

    // 国际
    { name: 'nhk', displayName: 'NHK News', category: 'international', type: 'rss', config: JSON.stringify({ feedUrl: 'https://www3.nhk.or.jp/rss/news/cat0.xml' }) },

    // AI
    { name: 'hackernews', displayName: 'Hacker News', category: 'ai', type: 'rss', config: JSON.stringify({}) },
    { name: '36kr', displayName: '36氪', category: 'ai', type: 'rss', config: JSON.stringify({ feedUrl: 'https://36kr.com/feed' }) },
    { name: 'infoq', displayName: 'InfoQ', category: 'ai', type: 'rss', config: JSON.stringify({ feedUrl: 'https://www.infoq.cn/feed' }) },

    // GitHub
    { name: 'github-trending', displayName: 'GitHub Trending', category: 'github', type: 'scraper', config: JSON.stringify({}) },

    // 投资
    { name: 'eastmoney', displayName: '东方财富', category: 'investment', type: 'rest_api', config: JSON.stringify({}) },
  ];

  for (const src of sources) {
    await prisma.dataSource.upsert({
      where: { name: src.name },
      create: { ...src, schedule: null, isActive: true },
      update: { config: src.config, category: src.category },
    });
    console.log(`✓ ${src.displayName} (${src.category})`);
  }

  console.log(`\nTotal sources: ${await prisma.dataSource.count()}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
