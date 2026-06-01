import 'dotenv/config';
import { processCategory } from '../src/lib/pipeline';

async function main() {
  // 清空并重处理所有板块
  const categories = [
    { key: 'ai', limit: 20 },
    { key: 'github', limit: 25 },
  ];

  for (const { key, limit } of categories) {
    console.log(`\nProcessing ${key} (limit ${limit})...`);
    const result = await processCategory(key, limit);
    console.log(`  Processed: ${result.processed}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`);
    if (result.errors.length > 0) console.log('  Errors:', result.errors);
  }

  console.log('\nDone.');
}

main().catch(console.error);
