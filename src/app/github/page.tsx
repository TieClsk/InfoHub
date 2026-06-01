'use client';

import { useState } from 'react';
import { BarChart3, Star } from 'lucide-react';
import { NewsCard } from '@/components/news-card';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import useSWR from 'swr';

interface GithubItem {
  id: string; title: string; summary: string; sourceName: string;
  category: string; importance: number; tags: string; publishedAt: string; metadata: string | null;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function GithubPage() {
  const [sortBy, setSortBy] = useState<'rating' | 'stars'>('rating');
  const { data, isLoading } = useSWR<{ success: boolean; data: GithubItem[] }>(
    '/api/news?category=github&limit=25', fetcher
  );

  const repos = data?.data ? [...data.data] : [];

  // 按今日 Star 排序（从 metadata 提取 sourceRank）
  const getStarRank = (meta: string | null) => {
    if (!meta) return 0;
    try { return (JSON.parse(meta) as { sourceRank?: number }).sourceRank || 0; } catch { return 0; }
  };

  if (sortBy === 'stars') {
    repos.sort((a, b) => getStarRank(b.metadata) - getStarRank(a.metadata));
  } else {
    repos.sort((a, b) => b.importance - a.importance);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">GitHub 热榜</h1>
        <div className="flex items-center rounded-lg border">
          <Button
            variant={sortBy === 'rating' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSortBy('rating')}
            className="rounded-r-none"
          >
            <BarChart3 className="h-3.5 w-3.5 mr-1" />
            评分
          </Button>
          <Button
            variant={sortBy === 'stars' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSortBy('stars')}
            className="rounded-l-none"
          >
            <Star className="h-3.5 w-3.5 mr-1" />
            今日 Star
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-32" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-full" /><Skeleton className="h-4 w-20 mt-2" /></CardContent>
            </Card>
          ))}
        </div>
      ) : repos.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {repos.map((repo) => (
            <NewsCard
              key={repo.id}
              id={repo.id}
              title={repo.title}
              summary={repo.summary}
              sourceName={repo.sourceName}
              category={repo.category}
              importance={repo.importance}
              tags={repo.tags}
              publishedAt={repo.publishedAt}
              metadata={repo.metadata}
            />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-12">暂无数据</p>
      )}
    </div>
  );
}
