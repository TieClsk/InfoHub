import 'dotenv/config';

async function test(label: string, url: string, opts?: RequestInit) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(6000), ...opts });
    const t = await r.text();
    const isJson = t.startsWith('{') || t.startsWith('[');
    const isXml = t.includes('<rss') || t.startsWith('<?xml');
    const links = (t.match(/newsDetail/g) || []).length;
    console.log(`${isJson ? '📡' : isXml ? '📰' : '🌐'} ${label} [${r.status}] ${t.length}b, ${links} newsDetail links`);
    if (isJson || isXml) console.log(`   ${t.slice(0, 200).replace(/\n/g, ' ')}`);
  } catch (e) {
    console.log(`❌ ${label}: ${e instanceof Error ? e.message : 'fail'}`);
  }
}

async function main() {
  // 尝试各种端点
  console.log('=== API 端点 ===');
  await test('mapi-node', 'https://api.thepaper.cn/contentapi/nodeCont/25950?pageidx=1&pagesize=30');
  await test('mapi-node2', 'https://api.thepaper.cn/contentapi/nodeCont/25950?pageidx=2&pagesize=30');
  await test('wwwapi', 'https://www.thepaper.cn/wwwapi/nodeCont/25950');
  await test('load_index_v2', 'https://www.thepaper.cn/load_index.jsp?nodeids=25950&pageidx=1&isList=1');
  await test('load_more', 'https://www.thepaper.cn/load_more_index.jsp?nodeids=25950&pageidx=1');

  // RSS
  console.log('\n=== RSS ===');
  await test('rss_main', 'https://www.thepaper.cn/rss_1.xml');
  await test('rss_news', 'https://www.thepaper.cn/rss_news.xml');

  // 移动端
  console.log('\n=== 移动端 ===');
  await test('m.thepaper', 'https://m.thepaper.cn/');
  await test('m-newslist', 'https://m.thepaper.cn/wap/news_list.jsp');
  await test('m-api', 'https://m.thepaper.cn/api/news/list?page=1&size=30');

  // GraphQL?
  console.log('\n=== 其他 ===');
  await test('sitemap', 'https://www.thepaper.cn/sitemap.xml');
  await test('hot', 'https://www.thepaper.cn/wwwapi/hotNews/getHotNews');
}

main();
