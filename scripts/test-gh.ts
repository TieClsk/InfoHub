import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { fetchGithubTrending } from '../src/lib/fetchers/github-trending';

const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }) });

async function main() {
  // Check current state
  const before = await p.rawContent.count({ where: { sourceId: 'github-trending' } });
  console.log('Before:', before);

  // Try fetch
  const r = await fetchGithubTrending();
  console.log('Result:', r.success, 'data len:', r.data.length, 'error:', r.error?.slice(0, 200));

  const after = await p.rawContent.count({ where: { sourceId: 'github-trending' } });
  console.log('After:', after);

  if (r.data.length > 0) {
    r.data.slice(0, 2).forEach((d) => console.log('  ', d.title?.slice(0, 60), '| rank:', d.sourceRank));
  }
  await p.$disconnect();
}

main();
