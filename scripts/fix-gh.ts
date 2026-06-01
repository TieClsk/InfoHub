import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { fetchGithubTrending } from '../src/lib/fetchers/github-trending';
import { processCategory } from '../src/lib/pipeline';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function main() {
  await p.rawContent.deleteMany({ where: { sourceId: 'github-trending' } });
  const r = await fetchGithubTrending();
  console.log('Fetched:', r.data.length);

  await p.processedContent.deleteMany({ where: { category: 'github' } });
  await processCategory('github', 30);

  const gh = await p.processedContent.count({ where: { category: 'github' } });
  const total = await p.processedContent.count();
  console.log(`GitHub: ${gh}, Total: ${total}`);
  await p.$disconnect();
}

main();
