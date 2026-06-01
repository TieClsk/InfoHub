import 'dotenv/config';

async function tryUrl(url: string) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://finance.eastmoney.com/' },
      signal: AbortSignal.timeout(8000),
    });
    const t = await r.text();
    const isJson = t.startsWith('{') || t.startsWith('[');
    console.log(`${isJson ? '📡' : '🌐'} ${r.status}, len=${t.length} — ${url.slice(0, 70)}`);
    if (isJson) console.log(`   ${t.slice(0, 300)}`);
  } catch (e) {
    console.log(`❌ ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main() {
  // 东方财富快讯 API
  await tryUrl('https://np-listapi.eastmoney.com/comm/web/getNewsByColumns?client=web&column_code=096&page_size=20&page_index=1');
  await tryUrl('https://finance.eastmoney.com/a/czqyw.html');
  // 东方财富 全球财经新闻
  await tryUrl('https://push2his.eastmoney.com/api/qt/stock/trends2/get?fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58&secid=1.000001');
}

main();
