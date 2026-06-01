import 'dotenv/config';
import { fetchWithTimeout } from '../src/lib/fetcher-utils';

async function testUrl(label: string, url: string, headers?: Record<string, string>) {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    const text = await r.text();
    const ok = r.status === 200 && text.length > 200;
    console.log(`${ok ? '✅' : '❌'} ${label}: status=${r.status}, len=${text.length}`);
    if (ok) console.log(`   Preview: ${text.slice(0, 150).replace(/\n/g, ' ')}`);
  } catch (e) {
    console.log(`❌ ${label}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main() {
  // 国际 — 国内可访问的替代源
  console.log('=== 国际新闻 ===');
  await testUrl('Bing News', 'https://www.bing.com/news?format=rss');
  await testUrl('NHK World', 'https://www3.nhk.or.jp/nhkworld/en/news/');
  await testUrl('Al Jazeera RSS', 'https://www.aljazeera.com/xml/rss/all.xml');
  await testUrl('南华早报 RSS', 'https://www.scmp.com/rss/91/feed');

  // 投资
  console.log('\n=== 投资资讯 ===');
  await testUrl('东方财富', 'https://finance.eastmoney.com/a/czqyw.html');
  await testUrl('雪球热帖', 'https://xueqiu.com/');
  await testUrl('Binance API', 'https://api.binance.com/api/v3/ticker/24hr?symbols=%5B%22BTCUSDT%22%5D');
  await testUrl('财联社', 'https://www.cls.cn/telegraph');

  // 国内补充
  console.log('\n=== 国内补充 ===');
  await testUrl('澎湃 RSS 验证', 'https://www.thepaper.cn/rss_1.xml');
  await testUrl('163 新闻', 'https://news.163.com/');
}

main();
