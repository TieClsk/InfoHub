import 'dotenv/config';
import { fetchBbcNews } from '../src/lib/fetchers/bbc';
import { processCategory } from '../src/lib/pipeline';

async function main() {
  console.log('Fetching BBC News...');
  const bbc = await fetchBbcNews();
  console.log(`  Success: ${bbc.success}, Items: ${bbc.data.length}`);
  if (bbc.error) console.log('  Error:', bbc.error);

  console.log('\nProcessing international with DeepSeek...');
  const result = await processCategory('international', 8);
  console.log(`  Processed: ${result.processed}, Errors: ${result.errors.length}`);
  if (result.errors.length) result.errors.forEach((e: string) => console.log('  ERR:', e));

  console.log('\nDone.');
}

main().catch(console.error);
