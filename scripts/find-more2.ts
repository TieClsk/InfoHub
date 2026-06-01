import 'dotenv/config';

async function test(label: string, url: string, opts?: RequestInit) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), ...opts });
    const t = await r.text();
    const ok = r.status === 200 && t.length > 500;
    console.log(`${ok ? '✅' : '❌'} ${label}: ${r.status} ${t.length} ${t.startsWith('{') ? 'JSON' : t.startsWith('<?xml') ? 'XML' : 'HTML'}`);
    if (ok) console.log(`   ${t.slice(0, 100).replace(/<[^>]+>/g, ' ').replace(/[\n\r]/g, ' ').slice(0, 100)}`);
  } catch (e) {
    console.log(`❌ ${label}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main() {
  // 国内综合新闻 — 更多源
  console.log('=== 国内综合 ===');
  await test('新浪新闻(社会)', 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2511&k=&num=30&page=1');
  await test('新浪新闻(科技)', 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2512&k=&num=30&page=1');
  await test('新浪新闻(财经)', 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2516&k=&num=30&page=1');
  await test('百度热搜', 'https://top.baidu.com/board?tab=realtime');
  await test('澎湃首页', 'https://www.thepaper.cn/');

  // 投资
  console.log('\n=== 投资 ===');
  await test('新浪财经', 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2516&k=&num=30&page=1');
  await test('雪球热帖', 'https://xueqiu.com/statuses/hot/listV2.json?page=1&last_id=');
  await test('东方财富快讯', 'https://finance.eastmoney.com/a/czqyw.html');

  // 国际
  console.log('\n=== 国际 ===');
  await test('新浪新闻(国际)', 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2510&k=&num=30&page=1');
  await test('新浪新闻(军事)', 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2514&k=&num=30&page=1');
}

main();
