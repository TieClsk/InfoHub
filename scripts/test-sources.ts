import 'dotenv/config';
import { fetchWithTimeout } from '../src/lib/fetcher-utils';

async function testUrl(label: string, url: string) {
  try {
    const r = await fetchWithTimeout(url, 8000);
    const text = await r.text();
    const ok = r.status === 200 && text.length > 500;
    console.log(`${ok ? '✅' : '❌'} ${label}: status=${r.status}, len=${text.length}`);
    if (ok) console.log(`   Preview: ${text.slice(0, 120).replace(/\n/g, ' ')}`);
  } catch (e) {
    console.log(`❌ ${label}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main() {
  // 国内新闻 RSS
  console.log('=== 国内 ===');
  await testUrl('澎湃新闻', 'https://www.thepaper.cn/rss_1.xml');
  await testUrl('今日热榜(知乎)', 'https://tophub.today/n/mproPpoq6O');
  await testUrl('NewsQQ', 'https://news.qq.com/');

  // 国际新闻 RSS
  console.log('\n=== 国际 ===');
  await testUrl('Reuters', 'https://news.google.com/rss/search?q=reuters&hl=en-US&gl=US&ceid=US:en');
  await testUrl('Google News Top', 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en');
  await testUrl('Reuters RSS', 'https://feeds.reuters.com/reuters/topNews');

  // 投资
  console.log('\n=== 投资 ===');
  await testUrl('CoinGecko', 'https://api.coingecko.com/api/v3/trending');
  await testUrl('CoinGecko Simple', 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
}

main();
