import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { fetchGithubTrending } from '../src/lib/fetchers/github-trending';
import { processCategory } from '../src/lib/pipeline';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function main() {
  await p.rawContent.deleteMany({ where: { sourceId: 'github-trending' } });
  const r = await fetchGithubTrending();
  console.log(`Fetched: ${r.data.length}`);
  if (r.data.length) r.data.slice(0, 3).forEach((i) => console.log(`  ${i.title.slice(0, 80)}`));

  await p.processedContent.deleteMany({ where: { category: 'github' } });
  await processCategory('github', 15);

  const items = await p.processedContent.findMany({ where: { category: 'github' }, take: 3 });
  console.log('Processed:');
  items.forEach((i) => console.log(`  [${i.importance}] ${i.title.slice(0, 60)}`));

  await p.$disconnect();
}

main();
