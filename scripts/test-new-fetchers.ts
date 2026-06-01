import 'dotenv/config';
import { fetchRenminNews } from '../src/lib/fetchers/renmin';
import { fetchNhkNews } from '../src/lib/fetchers/nhk';
import { fetchClsNews } from '../src/lib/fetchers/cls';

async function main() {
  // 人民网
  console.log('=== 人民网（国内）===');
  const rm = await fetchRenminNews();
  console.log(`Success: ${rm.success}, Items: ${rm.data.length}`);
  if (rm.data.length) {
    rm.data.slice(0, 3).forEach((i) => console.log(`  ${i.title.slice(0, 80)}`));
  }
  if (rm.error) console.log(`Error: ${rm.error}`);

  // NHK
  console.log('\n=== NHK（国际）===');
  const nhk = await fetchNhkNews();
  console.log(`Success: ${nhk.success}, Items: ${nhk.data.length}`);
  if (nhk.data.length) {
    nhk.data.slice(0, 3).forEach((i) => console.log(`  ${i.title.slice(0, 80)}`));
  }
  if (nhk.error) console.log(`Error: ${nhk.error}`);

  // 财联社
  console.log('\n=== 财联社（投资）===');
  const cls = await fetchClsNews();
  console.log(`Success: ${cls.success}, Items: ${cls.data.length}`);
  if (cls.data.length) {
    cls.data.slice(0, 3).forEach((i) => console.log(`  ${i.title.slice(0, 80)}`));
  }
  if (cls.error) console.log(`Error: ${cls.error}`);
}

main().catch(console.error);
