import 'dotenv/config';

async function test(label: string, url: string, opts?: RequestInit) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), ...opts });
    const t = await r.text();
    const isJson = t.startsWith('{') || t.startsWith('[');
    const ok = r.status === 200 && t.length > 300;
    console.log(`${ok ? '✅' : '❌'} ${label}: ${r.status} ${t.length} ${isJson ? 'JSON' : 'HTML'}`);
    if (ok && isJson) {
      try {
        const j = JSON.parse(t);
        const keys = Object.keys(j);
        const arrKey = keys.find(k => Array.isArray(j[k]));
        const count = arrKey ? j[arrKey].length : keys.length;
        console.log(`   Items: ${count}, keys: ${keys.slice(0, 5).join(',')}`);
        console.log(`   Preview: ${t.slice(0, 250)}`);
      } catch { console.log(`   ${t.slice(0, 150)}`); }
    }
    if (ok && !isJson) console.log(`   ${t.slice(0, 100).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ')}`);
  } catch (e) {
    console.log(`❌ ${label}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main() {
  // 澎湃新闻各种 API 尝试
  console.log('=== 澎湃新闻 API ===');
  await test('澎湃-推荐列表', 'https://www.thepaper.cn/wwwapi/article/list?pageidx=1&pagesize=50');
  await test('澎湃-推荐2', 'https://api.thepaper.cn/contentapi/nodeCont/xxx');
  await test('澎湃-loadList', 'https://www.thepaper.cn/load_index.jsp?nodeids=25462,25488&pageidx=1');
  await test('澎湃-热门', 'https://www.thepaper.cn/wwwapi/hotNews/getHotNews');
  await test('澎湃-loadList2', 'https://www.thepaper.cn/load_index.jsp?nodeids=25634&pageidx=1&isList=1');

  // 新闻列表页面（非JS渲染）
  console.log('\n=== 新闻列表页 ===');
  await test('澎湃-时事', 'https://www.thepaper.cn/channel_25950');
  await test('澎湃-财经', 'https://www.thepaper.cn/channel_25951');
  await test('澎湃-科技', 'https://www.thepaper.cn/channel_25953');

  // 尝试其他高容量新闻源替代
  console.log('\n=== 替代源 ===');
  await test('新浪新闻-多页', 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2509&k=&num=50&page=1');
  await test('新浪新闻-page2', 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2509&k=&num=50&page=2');
  await test('新浪新闻-page3', 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2509&k=&num=50&page=3');
  await test('百度热搜', 'https://top.baidu.com/board?tab=realtime');
}

main();
