import { NewsCard } from '@/components/news-card';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: 'domestic', label: '国内热点', icon: '🔥' },
  { key: 'international', label: '国际热点', icon: '🌍' },
  { key: 'ai', label: 'AI 动态', icon: '🤖' },
  { key: 'github', label: 'GitHub 热榜', icon: '⭐' },
  { key: 'investment', label: '投资资讯', icon: '📈' },
];

async function getTopNews() {
  try {
    const { prisma } = await import('@/lib/db');
    const results: Record<string, Array<Record<string, unknown>>> = {};
    for (const cat of CATEGORIES) {
      results[cat.key] = (await prisma.processedContent.findMany({
        where: { category: cat.key },
        orderBy: { importance: 'desc' },
        take: 3,
        select: {
          id: true,
          title: true,
          summary: true,
          sourceName: true,
          category: true,
          importance: true,
          tags: true,
          publishedAt: true,
          metadata: true,
        },
      })) as unknown as Array<Record<string, unknown>>;
    }
    return results;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const news = await getTopNews();

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">信息聚合</h1>
        <p className="text-muted-foreground mt-1">多源采集 · AI 精选 · 每日更新</p>
      </section>

      {CATEGORIES.map((cat) => (
        <section key={cat.key}>
          <h2 className="text-lg font-semibold mb-3">
            {cat.icon} {cat.label}
          </h2>
          {news?.[cat.key] && (news[cat.key] as Array<Record<string, unknown>>).length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(news[cat.key] as Array<Record<string, unknown>>).map((item) => (
                <NewsCard
                  key={item['id'] as string}
                  title={item['title'] as string}
                  summary={item['summary'] as string}
                  sourceName={item['sourceName'] as string}
                  category={item['category'] as string}
                  importance={item['importance'] as number}
                  tags={item['tags'] as string}
                  publishedAt={item['publishedAt'] as string}
                  metadata={item['metadata'] as string | null}
                />
              ))}
            </div>
          ) : (
            <NewsCardSkeleton />
          )}
        </section>
      ))}
    </div>
  );
}

function NewsCardSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-full mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-3/4 mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
