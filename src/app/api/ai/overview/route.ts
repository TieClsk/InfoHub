import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateOverview } from '@/lib/deepseek';
import type { ApiResponse } from '@/types';

const CATEGORIES: Record<string, string> = {
  domestic: '热点新闻',
  weibo: '微博舆论',
  international: '国际热点',
  ai: 'AI 动态',
  github: 'GitHub 热榜',
  investment: '投资资讯',
};

export async function GET() {
  try {
    const results: Record<string, { label: string; overview: string; items: Array<{ title: string; summary: string }> }> = {};

    for (const [key, label] of Object.entries(CATEGORIES)) {
      const items = await prisma.processedContent.findMany({
        where: { category: key },
        orderBy: { importance: 'desc' },
        take: 10,
        select: { title: true, summary: true, sourceName: true, importance: true, publishedAt: true },
      });

      const overview = await generateOverview(
        label,
        items.map((i) => ({ ...i, publishedAt: i.publishedAt.toISOString() }))
      );

      results[key] = {
        label,
        overview,
        items: items.map((i) => ({ title: i.title, summary: i.summary })),
      };
    }

    const response: ApiResponse<typeof results> = { success: true, data: results };
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } },
      { status: 500 }
    );
  }
}
