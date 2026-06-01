import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }),
});

const NON_TECH = new Set([
  '鲑鱼', '虹鳟', '鱼类', '栖息', '生态',
  '航班', '飞机', '飞行员',
  '键盘', '波簧',
  '招聘', '求职', '面试',
  '歌曲', '音乐', '歌手', '天文', '小行星',
  '美联航', '航空公司',
]);

async function main() {
  const items = await prisma.processedContent.findMany({ where: { category: 'ai' } });
  console.log(`Before: ${items.length} AI items`);

  let deleted = 0;
  for (const item of items) {
    const combined = item.title + item.summary + item.tags;
    if (Array.from(NON_TECH).some((kw) => combined.includes(kw))) {
      await prisma.processedContent.delete({ where: { id: item.id } });
      console.log(`  - ${item.title.slice(0, 60)}`);
      deleted++;
    }
  }

  const remaining = await prisma.processedContent.count({ where: { category: 'ai' } });
  const total = await prisma.processedContent.count();
  console.log(`Deleted: ${deleted}, AI remaining: ${remaining}, Total: ${total}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
