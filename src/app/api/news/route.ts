import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { ApiResponse } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const sort = searchParams.get('sort') || 'rating';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const skip = (page - 1) * limit;

    const date = searchParams.get('date'); // YYYY-MM-DD

    const where: Record<string, unknown> = {};
    if (category) where['category'] = category;
    if (date) {
      const [y, m, d] = date.split('-').map(Number);
      const start = new Date(y!, m! - 1, d!, 0, 0, 0);
      const end = new Date(y!, m! - 1, d!, 23, 59, 59, 999);
      where['publishedAt'] = { gte: start, lte: end };
    }

    // 多源模式：取更多数据供前端排序
    const fetchLimit = sort === 'multi' ? 200 : limit;

    const rows = await prisma.processedContent.findMany({
      where,
      orderBy: [{ importance: 'desc' }, { publishedAt: 'desc' }],
      skip: sort === 'multi' ? 0 : skip,
      take: fetchLimit,
      select: {
        id: true, sourceName: true, category: true, subcategory: true,
        title: true, summary: true, importance: true, tags: true,
        language: true, publishedAt: true, createdAt: true, metadata: true,
      },
    });

    // 多源：按 sourceCount 降序 → importance 降序
    if (sort === 'multi') {
      rows.sort((a, b) => {
        let scA = 1; try { scA = (JSON.parse(a.metadata || '{}') as { sourceCount?: number }).sourceCount || 1; } catch {}
        let scB = 1; try { scB = (JSON.parse(b.metadata || '{}') as { sourceCount?: number }).sourceCount || 1; } catch {}
        if (scB !== scA) return scB - scA;
        return b.importance - a.importance;
      });
    }

    // 多源：JS 排序后分页；普通：Prisma 已分页
    const paged = sort === 'multi' ? rows.slice(skip, skip + limit) : rows;
    const total = sort === 'multi'
      ? rows.length
      : await prisma.processedContent.count({ where });

    const response: ApiResponse<typeof paged> = {
      success: true,
      data: paged,
      meta: { page, limit, total },
    };

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } },
      { status: 500 }
    );
  }
}
