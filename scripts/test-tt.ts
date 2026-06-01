import 'dotenv/config';
import { fetchToutiao } from '../src/lib/fetchers/toutiao';

async function main() {
  // Wait for DB init
  await new Promise((r) => setTimeout(r, 500));
  const result = await fetchToutiao();
  console.log('success:', result.success);
  console.log('data length:', result.data.length);
  if (result.data.length > 0) {
    result.data.slice(0, 3).forEach((d) =>
      console.log('  extId:', d.externalId, '| url:', d.externalUrl?.slice(0, 40), '| title:', d.title?.slice(0, 40))
    );
  }
  if (result.error) console.log('error:', result.error);
}

main();
