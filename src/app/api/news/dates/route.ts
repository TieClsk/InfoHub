import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // 只取最近 7 天的日期
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const rows = await prisma.processedContent.findMany({
      where: { publishedAt: { gte: sevenDaysAgo } },
      select: { publishedAt: true },
      orderBy: { publishedAt: 'desc' },
    });

    // 按日期统计数量
    const countMap = new Map<string, number>();
    for (const r of rows) {
      const d = r.publishedAt.toISOString().slice(0, 10);
      countMap.set(d, (countMap.get(d) || 0) + 1);
    }

    // 只保留 ≥3 条的日期
    const dates = [...countMap.entries()]
      .filter(([, count]) => count >= 3)
      .map(([date]) => date)
      .sort()
      .reverse();

    return NextResponse.json({ success: true, data: dates });
  } catch {
    return NextResponse.json({ success: false, data: [] }, { status: 500 });
  }
}
