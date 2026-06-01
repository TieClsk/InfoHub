import 'dotenv/config';

async function tryUrl(url: string, headers?: Record<string, string>) {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    const t = await r.text();
    const isJson = t.startsWith('{') || t.startsWith('[');
    console.log(`${isJson ? '📡' : '🌐'} ${url.slice(0, 80)}: ${r.status}, len=${t.length}`);
    if (isJson) console.log(`   ${t.slice(0, 300)}`);
  } catch (e) {
    console.log(`❌ ${url.slice(0, 60)}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main() {
  // 东方财富 API
  console.log('=== 东方财富 ===');
  await tryUrl('https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids=1.000001,0.399001&fields=f2,f3,f4,f12,f14');
  await tryUrl('https://np-anotice-stock.eastmoney.com/api/security/ann?page_size=20&page_index=1');

  // 雪球 API
  console.log('\n=== 雪球 ===');
  await tryUrl('https://xueqiu.com/statuses/hot/listV2.json?page=1&last_id=');

  // 其他
  console.log('\n=== 其他财经 ===');
  await tryUrl('https://finance.sina.com.cn/');
  await tryUrl('https://wallstreetcn.com/live/global?limit=20');
}

main();
