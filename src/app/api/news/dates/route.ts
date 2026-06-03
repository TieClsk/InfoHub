import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // 按日期分组统计
    const rows = await prisma.processedContent.findMany({
      select: { publishedAt: true },
      orderBy: { publishedAt: 'desc' },
    });

    // 提取唯一日期（YYYY-MM-DD）
    const dateSet = new Set<string>();
    for (const r of rows) {
      const d = r.publishedAt.toISOString().slice(0, 10);
      dateSet.add(d);
      if (dateSet.size >= 60) break; // 最多60天
    }

    const dates = [...dateSet].sort().reverse();
    return NextResponse.json({ success: true, data: dates });
  } catch {
    return NextResponse.json({ success: false, data: [] }, { status: 500 });
  }
}
