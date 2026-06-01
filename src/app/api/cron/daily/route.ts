import { NextRequest, NextResponse } from 'next/server';
import { fetchGithubTrending, fetchWeiboHotsearch, fetchHackerNews, fetchBbcNews } from '@/lib/fetchers';
import { processCategory } from '@/lib/pipeline';
import { cleanupRawContent } from '@/lib/pipeline';

const CATEGORIES = ['domestic', 'international', 'ai', 'github', 'investment'];
const retentionDays = parseInt(process.env['RAW_RETENTION_DAYS'] ?? '14', 10);

export async function GET(request: NextRequest) {
  // Vercel Cron 鉴权
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env['CRON_SECRET'];
  if (cronSecret && cronSecret.length >= 32) {
    const expected = `Bearer ${cronSecret}`;
    if (authHeader !== expected) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid CRON_SECRET' } },
        { status: 401 }
      );
    }
  }

  const logs: string[] = [];
  const start = Date.now();

  // 1. 采集所有已启用的数据源
  const fetchers = [
    { name: 'github-trending', fn: fetchGithubTrending },
    { name: 'weibo', fn: fetchWeiboHotsearch },
    { name: 'hackernews', fn: fetchHackerNews },
    { name: 'bbc', fn: fetchBbcNews },
  ];

  for (const { name, fn } of fetchers) {
    try {
      const result = await fn();
      logs.push(`[fetch] ${name}: ${result.success ? `OK (${result.data.length} items)` : `FAIL: ${result.error}`}`);
    } catch (err) {
      logs.push(`[fetch] ${name}: ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 2. AI 处理各板块未处理数据
  for (const category of CATEGORIES) {
    try {
      const result = await processCategory(category, 30);
      logs.push(`[process] ${category}: processed=${result.processed}, errors=${result.errors.length}`);
    } catch (err) {
      logs.push(`[process] ${category}: ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 3. 清理过期原始数据
  try {
    const { deleted, duration } = await cleanupRawContent(retentionDays);
    logs.push(`[cleanup] deleted ${deleted} raw records in ${duration}ms`);
  } catch (err) {
    logs.push(`[cleanup] ERROR: ${err instanceof Error ? err.message : String(err)}`);
  }

  const totalDuration = Date.now() - start;
  logs.push(`[done] total duration: ${totalDuration}ms`);

  return NextResponse.json({ success: true, logs, duration: totalDuration });
}
