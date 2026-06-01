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
      },
    });

    // 为每个源查询最近一次采集日志（sourceId = DataSource.name）
    const sourceNames = sources.map((s) => s.name);
    const recentLogs = await prisma.fetchLog.findMany({
      where: { sourceId: { in: sourceNames } },
      orderBy: { fetchedAt: 'desc' },
    });

    const logMap = new Map<string, typeof recentLogs[0]>();
    for (const log of recentLogs) {
      if (!logMap.has(log.sourceId)) {
        logMap.set(log.sourceId, log);
      }
    }

    const summary = sources.map((s) => {
      const lastLog = logMap.get(s.name) ?? null;
      return {
        id: s.id,
        name: s.name,
        displayName: s.displayName,
        category: s.category,
        type: s.type,
        isActive: s.isActive,
        lastFetchAt: s.lastFetchAt,
        lastLog: lastLog
          ? {
              status: lastLog.status,
              total: lastLog.total,
              newCount: lastLog.newCount,
              fetchedAt: lastLog.fetchedAt,
            }
          : null,
      };
    });

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
