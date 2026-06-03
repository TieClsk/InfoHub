import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env['DATABASE_URL'] || 'file:./prisma/dev.db' }),
});

async function main() {
  const sources = [
    // === domestic ===
    { name: 'renmin', displayName: '人民网', category: 'domestic', type: 'rss', config: JSON.stringify({ feedUrl: 'http://www.people.com.cn/rss/politics.xml' }) },
    { name: 'sina', displayName: '新浪新闻', category: 'domestic', type: 'rest_api', config: JSON.stringify({}) },
    { name: 'sina-social', displayName: '新浪社会', category: 'domestic', type: 'rest_api', config: JSON.stringify({}) },
    { name: 'sina-mil', displayName: '新浪军事', category: 'domestic', type: 'rest_api', config: JSON.stringify({}) },
    { name: 'toutiao', displayName: '今日头条', category: 'domestic', type: 'rest_api', config: JSON.stringify({}) },
    { name: 'netease', displayName: '网易新闻', category: 'domestic', type: 'rest_api', config: JSON.stringify({}) },
    { name: 'thepaper', displayName: '澎湃新闻', category: 'domestic', type: 'scraper', config: JSON.stringify({}) },
    { name: 'baidu', displayName: '百度热搜', category: 'domestic', type: 'scraper', config: JSON.stringify({}) },

    // === international ===
    { name: 'nhk', displayName: 'NHK News', category: 'international', type: 'rss', config: JSON.stringify({ feedUrl: 'https://www3.nhk.or.jp/rss/news/cat0.xml' }) },
    { name: 'sina-intl', displayName: '新浪国际', category: 'international', type: 'rest_api', config: JSON.stringify({}) },
    { name: 'huanqiu', displayName: '环球网', category: 'international', type: 'scraper', config: JSON.stringify({}) },
    { name: 'npr', displayName: 'NPR News', category: 'international', type: 'rss', config: JSON.stringify({ feedUrl: 'https://feeds.npr.org/1001/rss.xml' }) },
    { name: 'france24', displayName: 'France 24', category: 'international', type: 'rss', config: JSON.stringify({ feedUrl: 'https://www.france24.com/en/rss' }) },
    { name: 'rt', displayName: 'RT News', category: 'international', type: 'rss', config: JSON.stringify({ feedUrl: 'https://www.rt.com/rss/' }) },

    // === ai ===
    { name: 'hackernews', displayName: 'Hacker News', category: 'ai', type: 'rss', config: JSON.stringify({}) },
    { name: '36kr', displayName: '36氪', category: 'ai', type: 'rss', config: JSON.stringify({ feedUrl: 'https://36kr.com/feed' }) },
    { name: 'infoq', displayName: 'InfoQ', category: 'ai', type: 'rss', config: JSON.stringify({ feedUrl: 'https://www.infoq.cn/feed' }) },
    { name: 'jiqizhixin', displayName: '机器之心', category: 'ai', type: 'rss', config: JSON.stringify({ feedUrl: 'https://www.jiqizhixin.com/rss' }) },

    // === github ===
    { name: 'github-trending', displayName: 'GitHub Trending', category: 'github', type: 'scraper', config: JSON.stringify({}) },

    // === investment ===
    { name: 'eastmoney', displayName: '东方财富', category: 'investment', type: 'scraper', config: JSON.stringify({}) },
    { name: 'sina-finance', displayName: '新浪财经', category: 'investment', type: 'rest_api', config: JSON.stringify({}) },
    { name: 'cls', displayName: '财联社', category: 'investment', type: 'scraper', config: JSON.stringify({}) },

    // === weibo ===
    { name: 'weibo', displayName: '微博热搜', category: 'weibo', type: 'rest_api', config: JSON.stringify({}) },
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
