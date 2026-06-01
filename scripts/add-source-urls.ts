import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }),
});

async function main() {
  const items = await prisma.processedContent.findMany({
    select: { id: true, rawContentId: true, metadata: true },
  });

  let updated = 0;

  for (const item of items) {
    try {
      const meta = JSON.parse(item.metadata || '{}') as Record<string, unknown>;
      if (meta['sourceUrl']) continue; // 已有 url，跳过

      if (item.rawContentId) {
        const raw = await prisma.rawContent.findUnique({
          where: { id: item.rawContentId },
          select: { externalUrl: true },
        });
        if (raw?.externalUrl) {
          meta['sourceUrl'] = raw.externalUrl;
          await prisma.processedContent.update({
            where: { id: item.id },
            data: { metadata: JSON.stringify(meta) },
          });
          updated++;
        }
      }
    } catch {
      // skip
    }
  }

  console.log(`Updated ${updated} of ${items.length} records with sourceUrl`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
