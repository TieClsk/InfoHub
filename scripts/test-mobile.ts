import 'dotenv/config';
import * as cheerio from 'cheerio';
import { fetchWithTimeout } from '../src/lib/fetcher-utils';

async function main() {
  const r = await fetchWithTimeout('https://m.thepaper.cn/');
  const html = await r.text();
  console.log('Status:', r.status, 'Len:', html.length);

  const $ = cheerio.load(html);

  // Check how many newsDetail links
  const ndLinks = $('a[href*="newsDetail"]');
  console.log('newsDetail links:', ndLinks.length);
  ndLinks.slice(0, 3).each((i, el) => console.log(' ', $(el).text().trim().slice(0, 40)));

  // Check main selectors
  console.log('h2 a:', $('h2 a').length);
  console.log('.news_li a:', $('.news_li a').length);
  console.log('a[href*="channel_"]:', $('a[href*="channel_"]').length);
  console.log('total a:', $('a').length);
}

main();
