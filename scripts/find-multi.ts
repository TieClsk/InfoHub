import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function main() {
  const items = await p.processedContent.findMany({
    select: { title: true, category: true, metadata: true, sourceName: true },
  });

  let found = 0;
  for (const i of items) {
    try {
      const m = JSON.parse(i.metadata || '{}') as { sourceCount?: number; sourceNames?: string[] };
      if ((m.sourceCount || 1) > 1) {
        found++;
        console.log(`sc=${m.sourceCount} [${(m.sourceNames || []).join(', ')}] ${i.title.slice(0, 50)}`);
      }
    } catch {}
  }

  console.log(`\nFound ${found}/${items.length} multi-source items`);
  await p.$disconnect();
}

main();
