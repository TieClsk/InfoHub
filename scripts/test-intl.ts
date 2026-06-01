import 'dotenv/config';

async function test(label: string, url: string, opts?: RequestInit) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), ...opts });
    const t = await r.text();
    const isJson = t.startsWith('{') || t.startsWith('[');
    const isXml = t.includes('<rss') || t.trim().startsWith('<?xml');
    const ok = r.status === 200 && t.length > 200;
    console.log(`${ok ? '✅' : '❌'} ${label}: ${r.status} ${t.length} ${isJson ? 'JSON' : isXml ? 'XML' : 'HTML'}`);
    if (ok && (isJson || isXml)) console.log(`   ${t.slice(0, 200).replace(/\n/g, ' ')}`);
    if (ok && isJson) {
      try { const j=JSON.parse(t); const k=Object.keys(j).find(k=>Array.isArray(j[k])); if(k) console.log(`   items: ${j[k].length}`); }
      catch {}
    }
  } catch (e) { console.log(`❌ ${label}: ${e instanceof Error ? e.message : 'fail'}`); }
}

async function main() {
  // 中文国际源
  console.log('=== 中文国际源 ===');
  await test('参考消息', 'https://www.cankaoxiaoxi.com/');
  await test('凤凰网', 'https://news.ifeng.com/rss/world.xml');
  await test('中国新闻网-国际', 'https://www.chinanews.com.cn/world/');
  await test('新浪国际(已用)', 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2510&k=&num=30&page=1');

  // 英文国际源(可能能用)
  console.log('\n=== 英文国际源 ===');
  await test('AP News RSS', 'https://www.apnews.com/rss');
  await test('NPR RSS', 'https://feeds.npr.org/1001/rss.xml');
  await test('Reuters RSS', 'https://news.google.com/rss/search?q=world&hl=en-US&gl=US&ceid=US:en');
  await test('France24 RSS', 'https://www.france24.com/en/rss');
  await test('DW RSS', 'https://rss.dw.com/rdf/rss-en-all');

  // 俄罗斯/中东视角
  console.log('\n=== 其他视角 ===');
  await test('RT RSS', 'https://www.rt.com/rss/');
  await test('Al Jazeera RSS', 'https://www.aljazeera.com/xml/rss/all.xml');
  await test('SCMP RSS', 'https://www.scmp.com/rss/91/feed');

  // 新浪更多频道
  console.log('\n=== 新浪更多 ===');
  await test('新浪-国际2', 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2511&k=&num=30&page=1');
  await test('新浪-全部', 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2967&k=&num=30&page=1');
}

main();
