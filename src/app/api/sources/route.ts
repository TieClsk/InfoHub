import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { ApiResponse } from '@/types';

export async function GET() {
  try {
    const sources = await prisma.dataSource.findMany({
      select: {
        id: true,
        name: true,
        displayName: true,
        category: true,
        type: true,
        isActive: true,
        lastFetchAt: true,
        fetchLogs: {
          orderBy: { fetchedAt: 'desc' },
          take: 1,
          select: {
            status: true,
            total: true,
            newCount: true,
            fetchedAt: true,
          },
        },
      },
    });

    const summary = sources.map((s) => ({
      ...s,
      lastLog: s.fetchLogs[0] ?? null,
      fetchLogs: undefined,
    }));

    const response: ApiResponse<typeof summary> = {
      success: true,
      data: summary,
    };

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=120' },
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
