import 'dotenv/config';

async function tryUrl(url: string) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.cls.cn/telegraph' },
      signal: AbortSignal.timeout(8000),
    });
    const t = await r.text();
    const isJson = t.startsWith('{') || t.startsWith('[');
    console.log(`${isJson ? '📡' : '🌐'} ${url}: ${r.status}, len=${t.length}`);
    if (isJson) console.log(`   ${t.slice(0, 250)}`);
  } catch (e) {
    console.log(`❌ ${url}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main() {
  await tryUrl('https://www.cls.cn/api/telegraph/list?app=cailianpress&page=1');
  await tryUrl('https://www.cls.cn/nodeapi/telegraphList?page=1');
  await tryUrl('https://www.cls.cn/v2/roll/get_roll_list?app=CailianpressWeb&page=1');
  await tryUrl('https://www.cls.cn/api/telegraph/list?rn=20');
  await tryUrl('https://www.cls.cn/nodeapi/updateTelegraphList');
  await tryUrl('https://www.cls.cn/nodeapi/telegraphs');
}

main();
