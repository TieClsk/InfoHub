'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import ReactMarkdown from 'react-markdown';
import { Skeleton } from '@/components/ui/skeleton';
import type { ApiResponse } from '@/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function getWeekStr(date: Date): string {
  const year = date.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const days = Math.floor((date.getTime() - jan1.getTime()) / 86400000);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function WeeklyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const week = searchParams.get('week') ?? getWeekStr(new Date());

  const { data, isLoading } = useSWR<ApiResponse<{ content: string }>>(
    `/api/weekly?week=${week}`,
    fetcher
  );

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">周报</h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const [y, w] = week.split('-W');
              const d = new Date(parseInt(y!), 0, 1);
              d.setDate(d.getDate() + (parseInt(w!) - 1) * 7);
              d.setDate(d.getDate() - 7);
              router.push(`/weekly?week=${getWeekStr(d)}`);
            }}
            className="px-3 py-1 rounded border text-sm"
          >
            上一周
          </button>
          <button
            onClick={() => {
              const [y, w] = week.split('-W');
              const d = new Date(parseInt(y!), 0, 1);
              d.setDate(d.getDate() + (parseInt(w!) - 1) * 7);
              d.setDate(d.getDate() + 7);
              router.push(`/weekly?week=${getWeekStr(d)}`);
            }}
            className="px-3 py-1 rounded border text-sm"
          >
            下一周
          </button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{week}</p>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ) : data?.data?.content ? (
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <ReactMarkdown>{data.data.content}</ReactMarkdown>
        </article>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p>暂无本周周报</p>
          <p className="text-sm mt-2">每周一自动生成，请稍后回来查看</p>
        </div>
      )}
    </div>
  );
}
