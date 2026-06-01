import 'dotenv/config';
import { fetchGithubTrending } from '../src/lib/fetchers/github-trending';

async function main() {
  console.log('Testing GitHub Trending fetcher...');
  const result = await fetchGithubTrending();
  console.log('Success:', result.success);
  console.log('Items count:', result.data.length);
  if (result.data.length > 0) {
    console.log('First item:', JSON.stringify(result.data[0], null, 2));
  }
  if (result.error) {
    console.log('Error:', result.error);
  }
}

main().catch(console.error);
