import 'dotenv/config';

async function tryUrl(label: string, url: string, opts?: RequestInit) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), ...opts });
    const t = await r.text();
    const isJson = t.startsWith('{') || t.startsWith('[');
    const isXml = t.trim().startsWith('<?xml') || t.trim().startsWith('<rss');
    const ok = r.status === 200 && t.length > 200;
    console.log(`${ok ? '✅' : '❌'} ${label}: ${r.status} len=${t.length} ${isJson ? 'JSON' : isXml ? 'XML' : 'HTML'}`);
    if (ok) {
      if (isJson) console.log(`   ${t.slice(0, 200)}`);
      else console.log(`   ${t.slice(0, 100).replace(/\n/g, ' ')}`);
    }
  } catch (e) {
    console.log(`❌ ${label}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main() {
  // 微博热搜 — 多种尝试
  console.log('=== 微博热搜 ===');
  await tryUrl('weibo-hot1', 'https://weibo.com/ajax/side/hotSearch', {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://weibo.com/', 'X-Requested-With': 'XMLHttpRequest' },
  });
  await tryUrl('weibo-api2', 'https://m.weibo.cn/api/container/getIndex?containerid=106003type%3D25%26t%3D3%26disable_hot%3D1%26filter_type%3Drealtimehot');
  await tryUrl('resou', 'https://tenapi.cn/v2/weibohot');
  await tryUrl('vveq', 'https://api.vveq.com/api/weibo/hot');
  await tryUrl('api-hot', 'https://api-hot.efefee.cn/weibo');

  // 国内补充
  console.log('\n=== 国内补充 ===');
  await tryUrl('163 news', 'https://news.163.com/special/wwwhot/');
  await tryUrl('zhihu hot', 'https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=20');
  await tryUrl('百度热搜', 'https://top.baidu.com/board?tab=realtime');

  // 国际补充
  console.log('\n=== 国际补充 ===');
  await tryUrl('BBC RSS', 'https://feeds.bbci.co.uk/news/rss.xml');
  await tryUrl('CNN RSS', 'http://rss.cnn.com/rss/edition.rss');
  await tryUrl('SCMP', 'https://www.scmp.com/rss/91/feed');
}

main();
