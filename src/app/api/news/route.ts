import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { ApiResponse } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (category) where['category'] = category;

    const [data, total] = await Promise.all([
      prisma.processedContent.findMany({
        where,
        orderBy: [{ importance: 'desc' }, { publishedAt: 'desc' }],
        skip,
        take: limit,
        select: {
          id: true,
          sourceName: true,
          category: true,
          subcategory: true,
          title: true,
          summary: true,
          importance: true,
          tags: true,
          language: true,
          publishedAt: true,
          createdAt: true,
          metadata: true,
        },
      }),
      prisma.processedContent.count({ where }),
    ]);

    const response: ApiResponse<typeof data> = {
      success: true,
      data,
      meta: { page, limit, total },
    };

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
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
