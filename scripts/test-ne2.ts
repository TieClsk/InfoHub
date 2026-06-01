import 'dotenv/config';
import * as cheerio from 'cheerio';

async function main() {
  // 试试新闻排行榜页
  const r = await fetch('https://news.163.com/rank/', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(8000),
  });
  const html = await r.text();
  const $ = cheerio.load(html);

  console.log('Page len:', html.length);

  // 找所有新闻链接
  const links: Array<{ title: string; href: string }> = [];
  $('a').each((i, el) => {
    const title = $(el).text().trim();
    const href = $(el).attr('href') || '';
    if (title.length >= 6 && title.length < 150 && href.includes('163.com') && href.includes('article')) {
      links.push({ title, href });
    }
  });

  console.log(`Article links: ${links.length}`);
  links.slice(0, 5).forEach(l => console.log(`  ${l.title.slice(0, 40)} -> ${l.href.slice(0, 50)}`));

  // Also try the 3g API with proper JSONP handling
  console.log('\nTrying 3g JSONP...');
  const r2 = await fetch('https://3g.163.com/touch/jsonp/sy/recommend/0-20.html', {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://3g.163.com/' },
    signal: AbortSignal.timeout(8000),
  });
  const t2 = await r2.text();
  console.log('3g len:', t2.length, t2.slice(0, 200));
}

main();
