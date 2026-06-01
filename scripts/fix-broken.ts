import 'dotenv/config';

async function test(label: string, url: string, opts?: RequestInit) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), ...opts });
    const t = await r.text();
    const isJson = t.startsWith('{') || t.startsWith('[');
    const isXml = t.includes('<rss') || t.trim().startsWith('<?xml');
    console.log(`${isJson ? '📡' : isXml ? '📰' : '🌐'} ${label}: ${r.status} ${t.length}`);
    if (isJson || isXml) console.log(`   ${t.slice(0, 200).replace(/\n/g, ' ')}`);
  } catch (e) {
    console.log(`❌ ${label}: ${e instanceof Error ? e.message : 'fail'}`);
  }
}

async function main() {
  // 机器之心
  console.log('=== 机器之心 ===');
  await test('RSS', 'https://www.jiqizhixin.com/rss');
  await test('API-articles', 'https://www.jiqizhixin.com/api/articles?page=1&size=30');
  await test('API-discover', 'https://www.jiqizhixin.com/api/discover?page=1&size=30');

  // 财联社
  console.log('\n=== 财联社 ===');
  await test('telegraph', 'https://www.cls.cn/telegraph');
  await test('API-v1', 'https://www.cls.cn/v1/roll/get_roll_list?app=CailianpressWeb&page=1');
  await test('API-v2', 'https://www.cls.cn/api/telegraph/list?app=cailianpress&page=1');
  await test('depth', 'https://www.cls.cn/depth');
}

main();
