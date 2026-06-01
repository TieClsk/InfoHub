import 'dotenv/config';

async function test(label: string, url: string) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const t = await r.text();
    const isJson = t.startsWith('{') || t.startsWith('[');
    console.log(`${isJson ? '✅' : '❌'} ${label}: ${r.status} len=${t.length}`);
    if (isJson) {
      const j = JSON.parse(t);
      const count = Array.isArray(j) ? j.length : j.result?.data?.length || j.data?.length || j.list?.length || Object.keys(j).length;
      console.log(`   Items count: ${count}`);
      console.log(`   Preview: ${t.slice(0, 200)}`);
    } else {
      console.log(`   Preview: ${t.slice(0, 100)}`);
    }
  } catch (e) {
    console.log(`❌ ${label}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main() {
  // 新浪 num=100 测试
  console.log('=== 新浪 ===');
  await test('新浪(num=100)', 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2509&k=&num=100&page=1');
  await test('新浪社会(num=100)', 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2511&k=&num=100&page=1');

  // 网易
  console.log('\n=== 网易 ===');
  await test('网易(100)', 'https://c.m.163.com/nc/article/headline/T1348647853363/0-100.html');

  // 头条
  console.log('\n=== 头条 ===');
  await test('头条热榜', 'https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc');

  // 澎湃
  console.log('\n=== 澎湃 ===');
  await test('澎湃API', 'https://www.thepaper.cn/wwwapi/article/list?pageidx=1&pagesize=50');
}

main();
