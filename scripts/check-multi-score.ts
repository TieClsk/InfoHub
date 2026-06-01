import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function main() {
  for (const cat of ['domestic', 'investment', 'international', 'ai', 'weibo', 'github']) {
    const items = await p.processedContent.findMany({
      where: { category: cat },
      select: { title: true, metadata: true, importance: true },
    });

    // 按 importance 排序
    items.sort((a, b) => b.importance - a.importance);

    let firstMultiIdx = -1;
    for (let i = 0; i < items.length; i++) {
      try {
        const m = JSON.parse(items[i]!.metadata || '{}') as { sourceCount?: number };
        if ((m.sourceCount || 1) > 1 && firstMultiIdx === -1) {
          firstMultiIdx = i;
          console.log(`${cat}: first multi at rank #${i + 1}, score ${items[i]!.importance.toFixed(1)}: ${items[i]!.title.slice(0, 40)}`);
        }
      } catch {}
    }
    if (firstMultiIdx === -1) console.log(`${cat}: no multi-source items`);
  }

  // Check investment multi items specifically
  console.log('\n=== Investment multi-source details ===');
  const inv = await p.processedContent.findMany({
    where: { category: 'investment' },
    select: { title: true, metadata: true, importance: true },
  });
  inv.sort((a, b) => b.importance - a.importance);
  for (let i = 0; i < Math.min(30, inv.length); i++) {
    try {
      const m = JSON.parse(inv[i]!.metadata || '{}') as { sourceCount?: number };
      if ((m.sourceCount || 1) > 1) {
        console.log(`  rank #${i + 1} imp=${inv[i]!.importance.toFixed(1)} sc=${m.sourceCount} ${inv[i]!.title.slice(0, 40)}`);
      }
    } catch {}
  }

  await p.$disconnect();
}

main();
