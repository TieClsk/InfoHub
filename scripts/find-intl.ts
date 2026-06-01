import 'dotenv/config';

async function test(label: string, url: string) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const t = await r.text();
    const ok = r.status === 200 && t.length > 500;
    console.log(`${ok ? '✅' : '❌'} ${label}: ${r.status} len=${t.length} ${t.startsWith('{') ? 'JSON' : t.startsWith('<?xml') ? 'XML' : ''}`);
    if (ok) console.log(`   ${t.slice(0, 100).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 100)}`);
  } catch (e) {
    console.log(`❌ ${label}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main() {
  console.log('=== 中文国际新闻 ===');
  await test('新浪国际', 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2510&k=&num=30&page=1');
  await test('环球网', 'https://www.huanqiu.com/');
  await test('凤凰网国际', 'https://news.ifeng.com/rss/world.xml');

  console.log('\n=== 英文国际新闻 ===');
  await test('Reuters RSS', 'https://news.google.com/rss/search?q=world+news&hl=en-US&gl=US&ceid=US:en');
  await test('Al Jazeera', 'https://www.aljazeera.com/xml/rss/all.xml');
}

main();
