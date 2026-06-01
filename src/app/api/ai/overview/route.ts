import { NextRequest, NextResponse } from 'next/server';
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

interface OverviewResult {
  label: string;
  overview: string;
  questions: string[];
  items: Array<{ title: string; summary: string }>;
}

// 内存缓存（30分钟有效）
let cache: { data: Record<string, OverviewResult>; ts: number } | null = null;
const TTL = 30 * 60 * 1000; // 30 min

async function generateAll(): Promise<Record<string, OverviewResult>> {
  const results: Record<string, OverviewResult> = {};

  for (const [key, label] of Object.entries(CATEGORIES)) {
    const items = await prisma.processedContent.findMany({
      where: { category: key },
      orderBy: { importance: 'desc' },
      take: 10,
      select: { title: true, summary: true, sourceName: true, importance: true, publishedAt: true },
    });

    const { overview, questions } = await generateOverview(
      label,
      items.map((i) => ({ ...i, publishedAt: i.publishedAt.toISOString() }))
    );

    results[key] = {
      label,
      overview,
      questions,
      items: items.map((i) => ({ title: i.title, summary: i.summary })),
    };
  }

  cache = { data: results, ts: Date.now() };
  return results;
}

export async function GET() {
  // 返回缓存（如果有效）
  if (cache && Date.now() - cache.ts < TTL) {
    const response: ApiResponse<Record<string, OverviewResult>> = { success: true, data: cache.data };
    return NextResponse.json(response, {
      headers: { 'X-Cache': 'HIT' },
    });
  }

  try {
    const results = await generateAll();
    const response: ApiResponse<typeof results> = { success: true, data: results };
    return NextResponse.json(response, { headers: { 'X-Cache': 'MISS' } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } },
      { status: 500 }
    );
  }
}

// 强制刷新（cron 调用）
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env['CRON_SECRET'];
  if (cronSecret && cronSecret.length >= 32 && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid CRON_SECRET' } }, { status: 401 });
  }

  try {
    const results = await generateAll();
    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } },
      { status: 500 }
    );
  }
}
