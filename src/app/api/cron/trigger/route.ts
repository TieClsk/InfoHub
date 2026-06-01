import { NextRequest, NextResponse } from 'next/server';
import { processCategory, cleanupRawContent } from '@/lib/pipeline';
import { fetchGithubTrending } from '@/lib/fetchers';

const ALL_CATEGORIES = [
  'domestic',
  'international',
  'ai',
  'github',
  'investment',
];

export async function POST(request: NextRequest) {
  try {
    // 鉴权：检查 CRON_SECRET
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env['CRON_SECRET'];
    if (cronSecret && cronSecret.length >= 32) {
      if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid CRON_SECRET' } },
          { status: 401 }
        );
      }
    }

    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      category?: string;
    };

    const action = body.action ?? 'full';

    switch (action) {
      case 'fetch': {
        // 仅采集
        const result = await fetchGithubTrending();
        return NextResponse.json({ success: true, data: result });
      }
      case 'process': {
        // 仅 AI 处理
        const category = body.category ?? ALL_CATEGORIES[0]!;
        const result = await processCategory(category);
        return NextResponse.json({ success: true, data: result });
      }
      case 'cleanup': {
        // 仅清理
        const retentionDays = parseInt(
          process.env['RAW_RETENTION_DAYS'] ?? '14',
          10
        );
        const result = await cleanupRawContent(retentionDays);
        return NextResponse.json({ success: true, data: result });
      }
      case 'full':
      default: {
        // 全流程：采集 → 处理 → 清理
        const fetchResult = await fetchGithubTrending();
        const processResults = [];
        for (const cat of ALL_CATEGORIES) {
          processResults.push(await processCategory(cat, 30));
        }
        const retentionDays = parseInt(
          process.env['RAW_RETENTION_DAYS'] ?? '14',
          10
        );
        const cleanupResult = await cleanupRawContent(retentionDays);

        return NextResponse.json({
          success: true,
          data: {
            fetch: fetchResult,
            process: processResults,
            cleanup: cleanupResult,
          },
        });
      }
    }
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
