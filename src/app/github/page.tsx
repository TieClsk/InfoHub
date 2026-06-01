import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface TrendingRepo {
  id: string;
  repoName: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  todayStars: number;
  repoUrl: string;
  date: string;
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default async function GithubPage() {
  let repos: TrendingRepo[] = [];
  try {
    const { prisma } = await import('@/lib/db');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    repos = (await prisma.githubTrending.findMany({
      where: { date: today },
      orderBy: { todayStars: 'desc' },
      take: 25,
    })) as unknown as TrendingRepo[];
  } catch {
    // DB not available
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">GitHub 热榜</h1>
      {repos.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {repos.map((repo) => (
            <Card key={repo.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    <a
                      href={repo.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {repo.repoName}
                    </a>
                  </CardTitle>
                  <span className="text-xs font-medium text-amber-500">
                    ⭐ {formatCount(repo.todayStars)} today
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {repo.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {repo.description}
                  </p>
                )}
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  {repo.language && <span>{repo.language}</span>}
                  <span>⭐ {formatCount(repo.stars)}</span>
                  <span>🍴 {formatCount(repo.forks)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
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
