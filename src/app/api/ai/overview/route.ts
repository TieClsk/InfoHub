import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateUnifiedOverview } from '@/lib/deepseek';
import { getCache, setCache } from '@/lib/overview-cache';
import type { ApiResponse } from '@/types';

const MODULES = [
  { key: 'domestic', label: '时事热点', icon: '🔥', where: { category: { in: ['domestic', 'international'] } } },
  { key: 'domestic', label: '时政消息', icon: '🏛️', where: { sourceId: { in: ['renmin'] } } },
  { key: 'ai', label: '科技领域', icon: '🤖', where: { category: 'ai' } },
  { key: 'investment', label: '投资领域', icon: '📈', where: { category: 'investment' } },
  { key: 'github', label: 'GitHub热榜', icon: '⭐', where: { category: 'github' } },
  { key: 'weibo', label: '舆论消息', icon: '💬', where: { category: 'weibo' } },
];

async function refreshOverview() {
  const categories = [];
  for (const m of MODULES) {
    const items = await prisma.processedContent.findMany({
      where: m.where,
      orderBy: { importance: 'desc' },
      take: 10,
      select: { title: true, summary: true, sourceName: true, importance: true, publishedAt: true },
    });
    categories.push({ label: m.label, icon: m.icon, items: items.map((i) => ({ ...i, publishedAt: i.publishedAt.toISOString() })) });
  }

  const result = await generateUnifiedOverview(categories);
  return setCache(result);
}

export async function GET() {
  // 先检查文件缓存
  const cached = getCache();
  if (cached) {
    return NextResponse.json(
      { success: true, data: { modules: cached.modules, questions: cached.questions, ts: cached.ts } } as ApiResponse<typeof cached>,
      { headers: { 'X-Cache': 'HIT' } }
    );
  }

  try {
    const r = await refreshOverview();
    return NextResponse.json(
      { success: true, data: r } as ApiResponse<typeof r>,
      { headers: { 'X-Cache': 'MISS' } }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const cronSecret = process.env['CRON_SECRET'];
  if (cronSecret && cronSecret.length >= 32 && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }
  try {
    const r = await refreshOverview();
    return NextResponse.json({ success: true, data: r });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } },
      { status: 500 }
    );
  }
}
