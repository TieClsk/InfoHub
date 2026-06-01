import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { ApiResponse } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date'); // YYYY-MM-DD
    const language = searchParams.get('language');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (date) where['date'] = new Date(date);
    if (language) where['language'] = language;

    const [data, total] = await Promise.all([
      prisma.githubTrending.findMany({
        where,
        orderBy: { todayStars: 'desc' },
        skip,
        take: limit,
      }),
      prisma.githubTrending.count({ where }),
    ]);

    const response: ApiResponse<typeof data> = {
      success: true,
      data,
      meta: { page, limit, total },
    };

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
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
