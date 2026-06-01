import 'dotenv/config';
import { fetchWithTimeout } from '../src/lib/fetcher-utils';

async function testUrl(label: string, url: string) {
  try {
    const r = await fetchWithTimeout(url, 8000);
    const text = await r.text();
    // Check if it's XML
    const isXml = text.trim().startsWith('<?xml') || text.trim().startsWith('<rss');
    const isHtml = text.includes('<!DOCTYPE html') || text.includes('<html');
    console.log(`${isXml ? '📰' : '🌐'} ${label}: ${isXml ? 'XML RSS' : 'HTML'}, len=${text.length}`);
    if (isXml) console.log(`   ${text.slice(0, 200).replace(/\n/g, ' ')}`);
  } catch (e) {
    console.log(`❌ ${label}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main() {
  console.log('=== 国内 RSS ===');
  await testUrl('澎湃新闻 RSS', 'https://www.thepaper.cn/rss_1.xml');
  await testUrl('澎湃新闻 feed', 'https://www.thepaper.cn/feed');
  await testUrl('环球时报 RSS', 'https://www.globaltimes.cn/rss/news.xml');
  await testUrl('人民网 RSS', 'http://www.people.com.cn/rss/politics.xml');

  console.log('\n=== 国际 RSS ===');
  await testUrl('Bing News RSS', 'https://feeds.feedburner.com/bingnews');
  await testUrl('NHK RSS', 'https://www3.nhk.or.jp/rss/news/cat0.xml');
  await testUrl('Yahoo News RSS', 'https://news.yahoo.com/rss/');

  console.log('\n=== 财经 RSS ===');
  await testUrl('东方财富 RSS', 'https://finance.eastmoney.com/a/czqyw.html');
  await testUrl('华尔街见闻 RSS', 'https://wallstreetcn.com/rss');
}
main();
