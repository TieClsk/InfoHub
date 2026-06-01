import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { ApiResponse } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (source) where['sourceId'] = source;

    const [data, total] = await Promise.all([
      prisma.rawContent.findMany({
        where,
        orderBy: { fetchedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          sourceId: true,
          externalUrl: true,
          title: true,
          sourceRank: true,
          language: true,
          fetchedAt: true,
        },
      }),
      prisma.rawContent.count({ where }),
    ]);

    const response: ApiResponse<typeof data> = {
      success: true,
      data,
      meta: { page, limit, total },
    };

    return NextResponse.json(response);
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
