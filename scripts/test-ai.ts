import 'dotenv/config';
import { processCategory } from '../src/lib/pipeline';

async function main() {
  console.log('Testing AI pipeline with GitHub data...\n');

  const result = await processCategory('github', 10);
  console.log('Processed:', result.processed);
  console.log('Skipped:', result.skipped);
  if (result.errors.length > 0) {
    console.log('Errors:', result.errors);
  }
}

main().catch(console.error);
