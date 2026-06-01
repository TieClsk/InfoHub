import { NewsCard } from '@/components/news-card';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default async function GithubPage() {
  let repos: Array<Record<string, unknown>> = [];
  try {
    const { prisma } = await import('@/lib/db');
    repos = (await prisma.processedContent.findMany({
      where: { category: 'github' },
      orderBy: { importance: 'desc' },
      take: 25,
    })) as unknown as Array<Record<string, unknown>>;
  } catch {
    // DB not available
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">GitHub 热榜</h1>

      {repos.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {repos.map((repo) => (
            <NewsCard
              key={repo['id'] as string}
              title={repo['title'] as string}
              summary={repo['summary'] as string}
              sourceName={repo['sourceName'] as string}
              category={repo['category'] as string}
              importance={repo['importance'] as number}
              tags={repo['tags'] as string}
              publishedAt={repo['publishedAt'] as string}
              metadata={repo['metadata'] as string | null}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-32" /></CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-4 w-20 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
