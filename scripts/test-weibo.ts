import 'dotenv/config';
import { fetchWeiboHotsearch } from '../src/lib/fetchers/weibo';
import { processCategory } from '../src/lib/pipeline';

async function main() {
  console.log('Fetching Weibo...');
  const wb = await fetchWeiboHotsearch();
  console.log('Success:', wb.success, 'Items:', wb.data.length);
  if (wb.data.length > 0) {
    console.log('Top 3:');
    wb.data.slice(0, 3).forEach((i) => console.log(' ', i.title));
  }
  if (wb.error) console.log('Error:', wb.error);

  if (wb.success && wb.data.length > 0) {
    console.log('\nProcessing domestic with DeepSeek...');
    const result = await processCategory('domestic', 10);
    console.log('Processed:', result.processed, 'Errors:', result.errors.length);
    if (result.errors.length) result.errors.forEach((e: string) => console.log('ERR:', e));
  }
}

main().catch(console.error);
