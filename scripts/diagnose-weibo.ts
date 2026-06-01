import 'dotenv/config';
import { fetchWithTimeout } from '../src/lib/fetcher-utils';

async function main() {
  // Try multiple Weibo hot search sources
  const urls = [
    'https://tophub.today/n/KqndgxeLl9',
    'https://weibo.com/ajax/side/hotSearch',
    'https://tenapi.cn/v2/weibohot',
  ];

  for (const url of urls) {
    try {
      const r = await fetchWithTimeout(url, 5000);
      const text = await r.text();
      console.log(`\n=== ${url} ===`);
      console.log('Status:', r.status);
      console.log('Length:', text.length);
      console.log('Preview:', text.slice(0, 300));
    } catch (e) {
      console.log(`\n=== ${url} ===`);
      console.log('Error:', e instanceof Error ? e.message : String(e));
    }
  }
}

main();
