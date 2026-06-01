import 'dotenv/config';

async function test(label: string, url: string) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const t = await r.text();
    const isJson = t.startsWith('{') || t.startsWith('[');
    const ok = r.status === 200 && t.length > 200;
    console.log(`${ok ? '✅' : '❌'} ${label}: ${r.status} ${t.length} ${isJson ? 'JSON' : 'HTML'}`);
    if (ok && isJson) {
      try {
        const j = JSON.parse(t);
        const keys = Object.keys(j);
        const dataKey = keys.find(k => Array.isArray(j[k])) || keys[0];
        const count = dataKey ? (Array.isArray(j[dataKey]) ? j[dataKey].length : '?') : keys.length;
        console.log(`   items: ${count}, keys: ${keys.slice(0,3).join(',')}`);
        console.log(`   ${t.slice(0, 200)}`);
      } catch { console.log(`   ${t.slice(0, 100)}`); }
    }
  } catch (e) {
    console.log(`❌ ${label}: ${e instanceof Error ? e.message : 'fail'}`);
  }
}

async function main() {
  // 网易新闻各种 API
  console.log('=== 网易 API ===');
  // Different category IDs
  await test('头条(T1348647853363)', 'https://c.m.163.com/nc/article/headline/T1348647853363/0-100.html');
  await test('科技(T1348649580692)', 'https://c.m.163.com/nc/article/list/T1348649580692/0-100.html');
  await test('财经(T1348648756099)', 'https://c.m.163.com/nc/article/list/T1348648756099/0-100.html');
  await test('体育(T1348649079062)', 'https://c.m.163.com/nc/article/list/T1348649079062/0-100.html');
  await test('娱乐(T1348648517839)', 'https://c.m.163.com/nc/article/list/T1348648517839/0-100.html');

  // Alternative: 3g API
  console.log('\n=== 3g 网易 ===');
  await test('3g-头条', 'https://3g.163.com/touch/jsonp/topics/0-20.html');
  await test('3g-news', 'https://3g.163.com/touch/jsonp/sy/recommend/0-20.html');

  // news.163.com API
  console.log('\n=== news.163 ===');
  await test('news-hot', 'https://news.163.com/special/wwwhot/');
  await test('news-api', 'https://news.163.com/rank/');
}

main();
