import 'dotenv/config';

async function test(label: string, url: string, opts?: RequestInit) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), ...opts });
    const t = await r.text();
    const isJson = t.startsWith('{') || t.startsWith('[');
    const isXml = t.trim().startsWith('<?xml') || t.trim().startsWith('<rss') || t.includes('<rss');
    const ok = r.status === 200 && t.length > 300;
    const type = isJson ? 'JSON' : isXml ? 'XML' : 'HTML';
    console.log(`${ok ? '✅' : '❌'} ${label}: ${r.status} ${t.length} ${type}`);
    if (ok) console.log(`   ${t.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,80)}`);
  } catch (e) {
    console.log(`❌ ${label}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main() {
  // === 澎湃新闻 ===
  console.log('=== 澎湃新闻 ===');
  await test('澎湃-时事', 'https://www.thepaper.cn/rss_1.xml');
  await test('澎湃-财经', 'https://www.thepaper.cn/rss_3.xml');
  await test('澎湃-科技', 'https://www.thepaper.cn/rss_5.xml');
  await test('澎湃API', 'https://www.thepaper.cn/wwwapi/article/list?pageidx=1&pagesize=30');

  // === 环球网 ===
  console.log('\n=== 环球网 ===');
  await test('环球网首页', 'https://www.huanqiu.com/');
  await test('环球网API', 'https://www.huanqiu.com/api/list?node=channel%2Cnews&offset=0&limit=30');
  await test('环球网-国际', 'https://world.huanqiu.com/api/list?node=channel%2Cworld&offset=0&limit=30');

  // === 今日头条 ===
  console.log('\n=== 今日头条 ===');
  await test('头条API', 'https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc');
  await test('头条热搜', 'https://is.snssdk.com/api/news/feed/v51/?category=news_hot');

  // === 网易新闻 ===
  console.log('\n=== 网易新闻 ===');
  await test('网易热榜', 'https://news.163.com/special/wwwhot/');
  await test('网易API', 'https://c.m.163.com/nc/article/headline/T1348647853363/0-40.html');
  await test('网易头条', 'https://3g.163.com/touch/jsonp/topics/0-20.html');

  // === 失效源修复 ===
  console.log('\n=== 失效源修复 ===');
  await test('机器之心RSS', 'https://www.jiqizhixin.com/rss');
  await test('机器之心API', 'https://www.jiqizhixin.com/api/articles?page=1&size=30');
  await test('天行API(测试)', 'https://apis.tianapi.com/allnews/index?key=test&num=30');
  await test('财联社电报API', 'https://www.cls.cn/nodeapi/telegraphList');
  await test('微博热搜-alt', 'https://tenapi.cn/v2/weibohot');
  await test('微博热搜-api2', 'https://api-hot.efefee.cn/weibo');
}

main();
