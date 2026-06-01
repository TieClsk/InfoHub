import 'dotenv/config';
import { fetchWeiboHot } from '../src/lib/fetchers/weibo-hot';

async function main() {
  const r = await fetchWeiboHot();
  console.log(`Success: ${r.success}, Items: ${r.data.length}`);
  if (r.data.length) r.data.slice(0, 5).forEach((i) => console.log(`  ${i.title.slice(0, 60)}`));
  if (r.error) console.log(`Error: ${r.error}`);
}

main();
