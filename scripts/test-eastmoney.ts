import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { fetchEastmoneyNews } from '../src/lib/fetchers/eastmoney';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }),
});

async function main() {
  await prisma.dataSource.upsert({
    where: { name: 'eastmoney' },
    create: {
      name: 'eastmoney', displayName: '东方财富', category: 'investment', type: 'scraper',
      config: JSON.stringify({ url: 'https://finance.eastmoney.com/a/czqyw.html' }),
      schedule: '0 7,13,19 * * *',
    },
    update: {},
  });
  console.log('seed OK');

  const r = await fetchEastmoneyNews();
  console.log(`Success: ${r.success}, Items: ${r.data.length}`);
  if (r.data.length) r.data.slice(0, 3).forEach((i) => console.log(`  ${i.title.slice(0, 80)}`));
  if (r.error) console.log(`Error: ${r.error}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
