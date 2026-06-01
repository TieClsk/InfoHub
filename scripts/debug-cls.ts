import 'dotenv/config';
import { fetchWithTimeout } from '../src/lib/fetcher-utils';
import * as cheerio from 'cheerio';

async function main() {
  const r = await fetchWithTimeout('https://www.cls.cn/telegraph');
  const html = await r.text();
  const $ = cheerio.load(html);

  console.log('Page length:', html.length);

  // Check what elements exist
  console.log('\nClass names found:');
  const classes = new Set<string>();
  $('*[class]').each((i, el) => {
    const c = $(el).attr('class') || '';
    c.split(/\s+/).forEach((cl) => { if (cl.length > 2 && cl.length < 40) classes.add(cl); });
  });
  const sorted = Array.from(classes).sort();
  sorted.forEach((c) => {
    const count = $(`.${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).length;
    if (count >= 2) console.log(`  .${c} (${count})`);
  });

  // Look for text content
  console.log('\nBody text preview:');
  $('body').find('script,style').remove();
  const bodyText = $('body').text().trim().slice(0, 500);
  console.log(bodyText);
}

main();
