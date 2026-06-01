'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { NewsCard } from '@/components/news-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ApiResponse } from '@/types';

const CATEGORIES = [
  { key: 'domestic', label: '国内' },
  { key: 'international', label: '国际' },
  { key: 'ai', label: 'AI' },
  { key: 'investment', label: '投资' },
];

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function NewsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const category = searchParams.get('category') ?? 'domestic';
  const page = parseInt(searchParams.get('page') ?? '1', 10);

  const { data, isLoading } = useSWR<ApiResponse<Array<Record<string, unknown>>>>(
    `/api/news?category=${category}&page=${page}&limit=20`,
    fetcher
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">新闻列表</h1>

      <Tabs
        value={category}
        onValueChange={(v) => router.push(`/news?category=${v}`)}
      >
        <TabsList>
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c.key} value={c.key}>
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : data?.data?.length ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.data.map((item: Record<string, unknown>) => (
              <NewsCard
                key={item['id'] as string}
                title={item['title'] as string}
                summary={item['summary'] as string}
                sourceName={item['sourceName'] as string}
                category={item['category'] as string}
                importance={item['importance'] as number}
                tags={item['tags'] as string[]}
                publishedAt={item['publishedAt'] as string}
              />
            ))}
          </div>

          {data.meta && (
            <div className="flex justify-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => router.push(`/news?category=${category}&page=${page - 1}`)}
                className="px-3 py-1 rounded border text-sm disabled:opacity-50"
              >
                上一页
              </button>
              <span className="px-3 py-1 text-sm text-muted-foreground">
                {page} / {Math.ceil((data.meta.total || 1) / (data.meta.limit || 20))}
              </span>
              <button
                disabled={page * (data.meta.limit || 20) >= (data.meta.total || 0)}
                onClick={() => router.push(`/news?category=${category}&page=${page + 1}`)}
                className="px-3 py-1 rounded border text-sm disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-muted-foreground text-center py-12">暂无数据，请先启动数据采集</p>
      )}
    </div>
  );
}
