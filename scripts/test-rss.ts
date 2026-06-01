import 'dotenv/config';
import { fetchJiqizhixin } from '../src/lib/fetchers/jiqizhixin';

async function main() {
  console.log('Testing 机器之心 RSS...');
  const result = await fetchJiqizhixin();
  console.log('Success:', result.success);
  console.log('Items:', result.data.length);
  if (result.data.length > 0) {
    console.log('First:', result.data[0]?.title?.slice(0, 80));
    console.log('Last:', result.data[result.data.length - 1]?.title?.slice(0, 80));
  }
  if (result.error) console.log('Error:', result.error);
}

main().catch(console.error);
