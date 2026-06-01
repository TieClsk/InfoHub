import 'dotenv/config';

async function main() {
  const nodes = ['channel%2Cnews', 'channel%2Cworld', 'channel%2Cfinance', 'channel%2Ctech', 'channel%2Cmil'];
  const allItems: Array<{ title: string; aid: string }> = [];

  for (const node of nodes) {
    let total = 0;
    for (let offset = 0; offset <= 90; offset += 30) {
      try {
        const r = await fetch(`https://www.huanqiu.com/api/list?node=${node}&offset=${offset}&limit=30`, { signal: AbortSignal.timeout(8000) });
        const j = (await r.json()) as { list?: Array<{ aid: string; title: string }> };
        const list = j.list || [];
        console.log(`  ${node} offset=${offset}: ${list.length} items`);
        for (const item of list) {
          allItems.push(item);
        }
        total += list.length;
        if (list.length < 10) break;
      } catch {
        break;
      }
    }
    console.log(`  ${node} total: ${total}`);
  }

  // Dedup by aid
  const seen = new Set<string>();
  const unique = allItems.filter((i) => {
    if (seen.has(i.aid)) return false;
    seen.add(i.aid);
    return true;
  });
  console.log(`\nTotal unique: ${unique.length}`);
}

main();
