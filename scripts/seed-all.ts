import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }),
});

const SOURCES = [
  // 国内
  { name: 'renmin', displayName: '人民网', category: 'domestic', type: 'rss', feedUrl: 'http://www.people.com.cn/rss/politics.xml' },
  { name: 'sina', displayName: '新浪新闻', category: 'domestic', type: 'rest_api', feedUrl: 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2509&num=30' },
  // 微博（独立板块）
  { name: 'weibo', displayName: '微博热搜', category: 'weibo', type: 'rest_api', feedUrl: 'https://weibo.com/ajax/side/hotSearch' },
  // 国际
  { name: 'nhk', displayName: 'NHK News', category: 'international', type: 'rss', feedUrl: 'https://www3.nhk.or.jp/rss/news/cat0.xml' },
  // AI/科技
  { name: 'hackernews', displayName: 'Hacker News', category: 'ai', type: 'rss', feedUrl: 'https://hnrss.org/frontpage?count=30' },
  { name: '36kr', displayName: '36氪', category: 'ai', type: 'rss', feedUrl: 'https://36kr.com/feed' },
  { name: 'infoq', displayName: 'InfoQ', category: 'ai', type: 'rss', feedUrl: 'https://www.infoq.cn/feed' },
  // GitHub
  { name: 'github-trending', displayName: 'GitHub Trending', category: 'github', type: 'scraper', feedUrl: 'https://github.com/trending' },
  // 投资
  { name: 'eastmoney', displayName: '东方财富', category: 'investment', type: 'scraper', feedUrl: 'https://finance.eastmoney.com/a/czqyw.html' },
];

async function main() {
  for (const src of SOURCES) {
    await prisma.dataSource.upsert({
      where: { name: src.name },
      create: {
        name: src.name, displayName: src.displayName, category: src.category, type: src.type,
        config: JSON.stringify({ feedUrl: src.feedUrl }),
        schedule: '0 7,13,19 * * *',
      },
      update: { category: src.category, config: JSON.stringify({ feedUrl: src.feedUrl }) },
    });
    console.log(`✓ ${src.displayName} → ${src.category}`);
  }
  console.log(`\nTotal: ${await prisma.dataSource.count()} sources`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
