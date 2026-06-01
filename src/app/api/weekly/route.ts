import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { ApiResponse } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week'); // 2025-W01

    let where: Record<string, unknown> = {};
    if (week) {
      // 解析 ISO 周：2025-W01 → 该周的起始和结束日期
      const [year, weekNum] = week.split('-W');
      const weekStart = getWeekStart(
        parseInt(year!, 10),
        parseInt(weekNum!, 10)
      );
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      where = {
        weekStart: { gte: weekStart },
        weekEnd: { lte: weekEnd },
      };
    }

    const data = await prisma.weeklySummary.findFirst({
      where,
      orderBy: { weekStart: 'desc' },
    });

    const response: ApiResponse<typeof data> = {
      success: true,
      data: data ?? undefined,
    };

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=3600' },
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

function getWeekStart(year: number, week: number): Date {
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay() || 7;
  const weekOneStart = new Date(jan1);
  weekOneStart.setDate(jan1.getDate() - dayOfWeek + 1);
  const result = new Date(weekOneStart);
  result.setDate(result.getDate() + (week - 1) * 7);
  return result;
}
