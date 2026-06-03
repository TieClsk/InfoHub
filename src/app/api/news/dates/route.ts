import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const where: Record<string, unknown> = {};
    if (category) where['category'] = category;

    const rows = await prisma.processedContent.findMany({
      where,
      select: { publishedAt: true },
      orderBy: { publishedAt: 'desc' },
    });

    // 提取唯一日期（本地时区，避免 UTC 跨天偏差）
    const dateSet = new Set<string>();
    for (const r of rows) {
      const pub = r.publishedAt;
      const d = `${pub.getFullYear()}-${String(pub.getMonth() + 1).padStart(2, '0')}-${String(pub.getDate()).padStart(2, '0')}`;
      dateSet.add(d);
      if (dateSet.size >= 60) break;
    }

    const dates = [...dateSet].sort().reverse();
    return NextResponse.json({ success: true, data: dates });
  } catch {
    return NextResponse.json({ success: false, data: [] }, { status: 500 });
  }
}
