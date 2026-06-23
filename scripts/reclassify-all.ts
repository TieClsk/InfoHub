/**
 * 存量数据按内容重分类（一次性迁移）
 *
 * 历史 ProcessedContent.category 是按来源打的（如所有人民网都标 domestic）。
 * 本脚本用 classifyCategory 按「标题+摘要」内容本身重新分配 category，
 * 使前端各板块真正按内容划分。github 板块钉死、不处理。
 *
 * 运行：npx tsx scripts/reclassify-all.ts
 */
import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { classifyCategory, normalizeCategory } from '../src/lib/deepseek';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env['DATABASE_URL'] || 'file:./dev.db' }),
});

const BATCH = 20;

function countByCategory(cats: string[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const c of cats) m[c] = (m[c] ?? 0) + 1;
  return m;
}

async function main(): Promise<void> {
  const items = await prisma.processedContent.findMany({
    where: { category: { not: 'github' } },
    select: { id: true, title: true, summary: true, category: true },
  });

  if (items.length === 0) {
    console.log('没有可重分类的条目。');
    return;
  }

  console.log(`共 ${items.length} 条待重分类（github 已排除）`);
  const before = countByCategory(items.map((i) => i.category));

  let changed = 0;
  let unchanged = 0;

  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    const results = await classifyCategory(
      batch.map((b) => ({ id: b.id, title: b.title, summary: b.summary }))
    );
    const resultById = new Map(results.map((r) => [r.id, r.category]));

    for (const it of batch) {
      const next = normalizeCategory(resultById.get(it.id), it.category); // AI 非法/缺失则回退原 category
      if (next && next !== it.category) {
        await prisma.processedContent.update({ where: { id: it.id }, data: { category: next } });
        changed++;
      } else {
        unchanged++;
      }
    }
    console.log(`  进度 ${Math.min(i + BATCH, items.length)}/${items.length}`);
  }

  const afterRows = await prisma.processedContent.findMany({
    where: { category: { not: 'github' } },
    select: { category: true },
  });
  const after = countByCategory(afterRows.map((r) => r.category));

  console.log(`\n变更 ${changed} 条，保持 ${unchanged} 条`);
  console.log('板块变化（前 → 后）：');
  const cats = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();
  for (const c of cats) {
    console.log(`  ${c.padEnd(14)} ${String(before[c] ?? 0).padStart(4)} → ${String(after[c] ?? 0).padStart(4)}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
