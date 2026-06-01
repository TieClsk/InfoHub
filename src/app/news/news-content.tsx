'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { NewsCard } from '@/components/news-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ApiResponse } from '@/types';

const CATEGORIES = [
  { key: 'domestic', label: '热点' },
  { key: 'weibo', label: '微博' },
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
                id={item['id'] as string}
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

          {data.meta && (() => {
            const totalPages = Math.max(1, Math.ceil((data.meta.total || 1) / (data.meta.limit || 20)));

            // 生成要显示的页码：1, ..., 当前附近, ..., X
            const pages: (number | string)[] = [1];
            if (page > 3) pages.push('...');
            for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) {
              pages.push(p);
            }
            if (page < totalPages - 2) pages.push('...');
            if (totalPages > 1) pages.push(totalPages);

            return (
              <div className="flex justify-center">
                <div className="inline-flex items-center border rounded-lg bg-background">
                  {/* 上一页 */}
                  <button
                    disabled={page <= 1}
                    onClick={() => router.push(`/news?category=${category}&page=${page - 1}`)}
                    className="px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-l-lg transition-colors disabled:opacity-30"
                  >‹</button>

                  {/* 页码 */}
                  {pages.map((p, i) =>
                    typeof p === 'string' ? (
                      <span key={`e${i}`} className="px-1 text-muted-foreground text-xs select-none">…</span>
                    ) : (
                      <button
                        key={p}
                        disabled={p === page}
                        onClick={() => router.push(`/news?category=${category}&page=${p}`)}
                        className={`min-w-[2rem] px-1.5 py-1.5 text-sm transition-colors ${
                          p === page
                            ? 'bg-primary text-primary-foreground font-medium'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >{p}</button>
                    )
                  )}

                  {/* 下一页 */}
                  <button
                    disabled={page >= totalPages}
                    onClick={() => router.push(`/news?category=${category}&page=${page + 1}`)}
                    className="px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-r-lg transition-colors disabled:opacity-30"
                  >›</button>
                </div>

              </div>
            );
          })()}
        </>
      ) : (
        <p className="text-muted-foreground text-center py-12">暂无数据，请先启动数据采集</p>
      )}
    </div>
  );
}
