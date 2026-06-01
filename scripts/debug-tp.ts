import 'dotenv/config';
import * as cheerio from 'cheerio';

async function main() {
  // Check what one page returns
  const r = await fetch('https://www.thepaper.cn/load_index.jsp?nodeids=25950&pageidx=1');
  const html = await r.text();
  const $ = cheerio.load(html);

  // Count all links
  let totalLinks = 0;
  let newsDetailLinks = 0;
  const samples: string[] = [];

  $('a').each((i, el) => {
    totalLinks++;
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    if (href.includes('newsDetail')) {
      newsDetailLinks++;
      if (samples.length < 3) samples.push(`${text.slice(0, 40)} -> ${href.slice(0, 50)}`);
    }
  });

  console.log(`Total links: ${totalLinks}, newsDetail: ${newsDetailLinks}`);
  samples.forEach((s) => console.log(' ', s));

  // Check page 2 has different links
  const r2 = await fetch('https://www.thepaper.cn/load_index.jsp?nodeids=25950&pageidx=2');
  const html2 = await r2.text();
  const $2 = cheerio.load(html2);
  let nd2 = 0;
  const hrefs1 = new Set<string>();
  $('a[href*="newsDetail"]').each((i, el) => { hrefs1.add($(el).attr('href') || ''); nd2++; });
  console.log(`\nPage 1 unique hrefs: ${hrefs1.size}`);

  $2('a[href*="newsDetail"]').each((i, el) => {
    const h = $(el).attr('href') || '';
    if (!hrefs1.has(h)) { console.log('  NEW on p2:', $(el).text().trim().slice(0, 40)); }
  });
}

main();
