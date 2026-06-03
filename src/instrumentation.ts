/**
 * Next.js Instrumentation — 服务端启动时注册 node-cron 定时任务。
 * 自托管环境下替代 Vercel Cron Jobs。
 */
export async function register(): Promise<void> {
  if (process.env['NEXT_RUNTIME'] === 'edge') return;

  const cron = await import('node-cron');
  const schedule = process.env['CRON_SCHEDULE'] ?? '0 8 * * *'; // 默认每天 8:00
  const weeklySchedule = process.env['CRON_WEEKLY_SCHEDULE'] ?? '0 9 * * 1'; // 默认每周一 9:00

  console.log(`[cron] 定时任务已注册 — 每日: ${schedule} | 周报: ${weeklySchedule}`);

  // 每日任务：采集 + AI 处理 + 清理 + 刷新缓存
  cron.default.schedule(schedule, async () => {
    console.log(`[cron] 每日任务开始 ${new Date().toISOString()}`);

    const { fetchGithubTrending, fetchHackerNews, fetchRenminNews, fetchNhkNews,
      fetchEastmoneyNews, fetchWeiboHot, fetchSinaNews, fetch36kr, fetchInfoq } = await import('@/lib/fetchers');
    const { processCategory, cleanupRawContent } = await import('@/lib/pipeline');

    const CATEGORIES = ['domestic', 'international', 'ai', 'github', 'investment', 'weibo'];
    const retentionDays = parseInt(process.env['RAW_RETENTION_DAYS'] ?? '14', 10);
    const cronSecret = process.env['CRON_SECRET'] || '';

    // 1. 采集
    const fetchers = [
      { name: 'github-trending', fn: fetchGithubTrending },
      { name: 'hackernews', fn: fetchHackerNews },
      { name: 'renmin', fn: fetchRenminNews },
      { name: 'nhk', fn: fetchNhkNews },
      { name: 'eastmoney', fn: fetchEastmoneyNews },
      { name: 'sina', fn: fetchSinaNews },
      { name: 'weibo', fn: fetchWeiboHot },
      { name: '36kr', fn: fetch36kr },
      { name: 'infoq', fn: fetchInfoq },
    ];

    for (const { name, fn } of fetchers) {
      try {
        const result = await fn();
        console.log(`[cron][fetch] ${name}: ${result.success ? `OK (${result.data.length} items)` : `FAIL: ${result.error}`}`);
      } catch (err) {
        console.error(`[cron][fetch] ${name}: ERROR: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 2. AI 处理
    for (const category of CATEGORIES) {
      try {
        const result = await processCategory(category, 30);
        console.log(`[cron][process] ${category}: processed=${result.processed}, errors=${result.errors.length}`);
      } catch (err) {
        console.error(`[cron][process] ${category}: ERROR: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 3. 清理
    try {
      const { deleted, duration } = await cleanupRawContent(retentionDays);
      console.log(`[cron][cleanup] deleted ${deleted} raw records in ${duration}ms`);
    } catch (err) {
      console.error(`[cron][cleanup] ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 4. 刷新 overview 缓存
    try {
      const { generateUnifiedOverview } = await import('@/lib/deepseek');
      const { prisma } = await import('@/lib/db');

      const MODULES = [
        { key: 'domestic', label: '时事热点', icon: '🔥', where: { category: { in: ['domestic', 'international'] } } },
        { key: 'domestic', label: '时政消息', icon: '🏛️', where: { sourceId: { in: ['renmin'] } } },
        { key: 'ai', label: '科技领域', icon: '🤖', where: { category: 'ai' } },
        { key: 'investment', label: '投资领域', icon: '📈', where: { category: 'investment' } },
        { key: 'github', label: 'GitHub热榜', icon: '⭐', where: { category: 'github' } },
        { key: 'weibo', label: '舆论消息', icon: '💬', where: { category: 'weibo' } },
      ];

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

      await generateUnifiedOverview(categories);
      console.log('[cron][overview] cache refreshed');
    } catch (err) {
      console.error(`[cron][overview] ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }

    console.log(`[cron] 每日任务完成`);
  });

  // 周报任务
  cron.default.schedule(weeklySchedule, async () => {
    console.log(`[cron] 周报任务开始 ${new Date().toISOString()}`);

    try {
      const { prisma } = await import('@/lib/db');
      const { generateWeeklySummary } = await import('@/lib/deepseek');

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const items = await prisma.processedContent.findMany({
        where: { importance: { gte: 7 }, createdAt: { gte: weekAgo } },
        orderBy: { importance: 'desc' },
        select: { title: true, summary: true, category: true, tags: true },
      });

      if (items.length > 0) {
        const content = await generateWeeklySummary(
          items.map((i) => ({ ...i, tags: i.tags || '[]' }))
        );

        const now = new Date();
        await prisma.weeklySummary.create({
          data: {
            weekStart: weekAgo,
            weekEnd: now,
            content,
            metadata: JSON.stringify({ itemCount: items.length }),
          },
        });

        console.log(`[cron][weekly] 周报已生成 (${items.length} items, ${content.length} chars)`);
      } else {
        console.log('[cron][weekly] 本周无高评分内容，跳过');
      }
    } catch (err) {
      console.error(`[cron][weekly] ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
}
