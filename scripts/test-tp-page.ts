import 'dotenv/config';
import { fetchWithTimeout } from '../src/lib/fetcher-utils';

async function test(label: string, url: string) {
  try {
    const r = await fetchWithTimeout(url, 5000);
    const t = await r.text();
    // Count newsDetail links
    const matches = t.match(/newsDetail/g);
    console.log(`${label}: len=${t.length}, newsDetail links=${matches?.length || 0}`);
  } catch (e) {
    console.log(`${label}: ${e instanceof Error ? e.message : 'fail'}`);
  }
}

async function main() {
  const base = 'https://www.thepaper.cn/channel_25950';
  // 尝试不同翻页参数
  for (const fmt of ['', '?pageidx=1', '?pageidx=2', '?page=1', '?page=2', '?p=1', '?p=2']) {
    await test(`channel${fmt}`, `${base}${fmt}`);
  }
  // 尝试 load_index
  await test('load_index', 'https://www.thepaper.cn/load_index.jsp?nodeids=25950&pageidx=1');
  await test('load_index2', 'https://www.thepaper.cn/load_index.jsp?nodeids=25950&pageidx=2');
}

main();
