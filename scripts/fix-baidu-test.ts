import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { fetchBaiduHot } from '../src/lib/fetchers/baidu-hot';
import { processCategory } from '../src/lib/pipeline';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function main() {
  // 1. 清理百度脏数据
  const old = await p.rawContent.findMany({ where: { sourceId: 'baidu' }, select: { id: true, title: true } });
  let bad = 0;
  for (const o of old) {
    if (/^\d+$/.test(o.title) || o.title.length < 4) {
      await p.rawContent.delete({ where: { id: o.id } });
      bad++;
    }
  }
  console.log(`Cleaned ${bad}/${old.length} bad baidu items`);

  // 2. 重新采集百度
  const r = await fetchBaiduHot();
  console.log(`Baidu re-fetch: ${r.success ? 'OK' : 'FAIL'}, ${r.data.length} items`);
  // 检查标题质量
  const samples = r.data.slice(0, 5);
  console.log('Samples:', samples.map((i) => i.title).join(' | '));

  // 3. 重处理投资板块（有明确跨源重叠）
  await p.processedContent.deleteMany({ where: { category: 'investment' } });
  console.log('\nProcessing investment with batched clustering...');
  const result = await processCategory('investment', 80);
  console.log(`Processed: ${result.processed}`);

  // 检查结果
  const items = await p.processedContent.findMany({
    where: { category: 'investment' },
    orderBy: { importance: 'desc' },
    take: 10,
  });
  console.log('\nTop investment (by importance):');
  for (const i of items) {
    let sc = 0, sn: string[] = [];
    try { const m = JSON.parse(i.metadata||'{}') as {sourceCount?:number; sourceNames?:string[]}; sc=m.sourceCount||0; sn=m.sourceNames||[]; } catch {}
    const marker = sc > 1 ? ` 🔗 ${sc}源[${sn.join(',')}]` : '';
    console.log(`  [${i.importance}] ${i.sourceName}${marker} | ${i.title.slice(0,50)}`);
  }

  await p.$disconnect();
}

main();
