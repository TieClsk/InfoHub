import { NewsCard } from '@/components/news-card';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface GithubItem {
  id: string;
  title: string;
  summary: string;
  sourceName: string;
  importance: number;
  tags: string;
  publishedAt: string;
  metadata: string | null;
}

export default async function GithubPage() {
  let repos: GithubItem[] = [];
  try {
    const { prisma } = await import('@/lib/db');
    repos = (await prisma.processedContent.findMany({
      where: { category: 'github' },
      orderBy: { importance: 'desc' },
      take: 25,
    })) as unknown as GithubItem[];
  } catch {
    // DB not available
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">GitHub 热榜</h1>

      {repos.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {repos.map((repo) => {
            let sourceRank: number | undefined;
            try {
              if (repo.metadata) {
                const meta = JSON.parse(repo.metadata) as { sourceRank?: number };
                sourceRank = meta.sourceRank ?? undefined;
              }
            } catch { /* ignore */ }

            return (
              <Card key={repo.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm line-clamp-2">{repo.title}</h3>
                    {sourceRank && (
                      <span className="text-xs font-medium text-amber-500 shrink-0 ml-2">
                        ⭐ {sourceRank} today
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">{repo.summary}</p>
                  <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                    <span>{repo.sourceName}</span>
                    <span>AI 评分：{repo.importance}/10</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
