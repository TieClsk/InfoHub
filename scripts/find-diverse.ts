import 'dotenv/config';

async function test(label: string, url: string, opts?: RequestInit) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), ...opts });
    const t = await r.text();
    const isXml = t.trim().startsWith('<?xml') || t.trim().startsWith('<rss');
    const isJson = t.startsWith('{') || t.startsWith('[');
    const ok = r.status === 200 && t.length > 500;
    console.log(`${ok ? '✅' : '❌'} ${label}: ${r.status} ${t.length} ${isXml ? 'XML' : isJson ? 'JSON' : ''}`);
    if (ok && isXml) console.log(`   ${t.slice(0, 150).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')}`);
    if (ok && isJson) console.log(`   ${t.slice(0, 150)}`);
  } catch (e) {
    console.log(`❌ ${label}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main() {
  // 国内综合新闻 RSS
  console.log('=== 国内综合 ===');
  await test('新浪新闻 RSS', 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2509&k=&num=30&page=1');
  await test('网易新闻', 'https://news.163.com/special/wwwhot/');
  await test('搜狐新闻 RSS', 'https://www.sohu.com/feed');
  await test('环球网 RSS', 'https://www.huanqiu.com/rss/news.xml');
  await test('央视新闻 RSS', 'https://news.cctv.com/rss/');

  // 国际新闻（中文来源）
  console.log('\n=== 国际（中文源）===');
  await test('环球网国际', 'https://world.huanqiu.com/rss/news.xml');
  await test('参考消息 RSS', 'https://www.cankaoxiaoxi.com/rss/');
  await test('凤凰网国际', 'https://news.ifeng.com/rss/world.xml');

  // AI/科技
  console.log('\n=== AI/科技 ===');
  await test('36氪 RSS', 'https://36kr.com/feed');
  await test('虎嗅 RSS', 'https://www.huxiu.com/rss/0.xml');
  await test('InfoQ RSS', 'https://www.infoq.cn/feed');
  await test('TechCrunch RSS', 'https://techcrunch.com/feed/');
  await test('ArXiv AI RSS', 'https://rss.arxiv.org/rss/cs.AI');
  await test('GitHub Trending RSS', 'https://mshibanami.github.io/GitHubTrendingRSS/daily/all.xml');
  await test('Dev.to RSS', 'https://dev.to/feed');
}

main();
