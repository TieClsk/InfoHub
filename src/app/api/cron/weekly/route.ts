import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateWeeklySummary } from '@/lib/deepseek';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env['CRON_SECRET'];
  if (cronSecret && cronSecret.length >= 32) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid CRON_SECRET' } },
        { status: 401 }
      );
    }
  }

  try {
    // 取本周 importance >= 7 的精选内容
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const items = await prisma.processedContent.findMany({
      where: {
        importance: { gte: 7 },
        createdAt: { gte: weekAgo },
      },
      orderBy: { importance: 'desc' },
      select: {
        title: true,
        summary: true,
        category: true,
        tags: true,
      },
    });

    if (items.length === 0) {
      return NextResponse.json({ success: false, error: { code: 'NO_DATA', message: '本周无高评分内容' } });
    }

    const content = await generateWeeklySummary(
      items.map((i) => ({ ...i, tags: i.tags || '[]' }))
    );

    // 写入周报
    const now = new Date();
    const weekStart = new Date(weekAgo);
    const weekEnd = new Date();

    await prisma.weeklySummary.create({
      data: {
        weekStart,
        weekEnd,
        content,
        metadata: JSON.stringify({ itemCount: items.length }),
      },
    });

    return NextResponse.json({
      success: true,
      data: { weekStart, weekEnd, contentLength: content.length },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
