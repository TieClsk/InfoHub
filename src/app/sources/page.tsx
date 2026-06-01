'use client';

import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { ApiResponse } from '@/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface SourceInfo {
  id: string;
  name: string;
  displayName: string;
  category: string;
  type: string;
  isActive: boolean;
  lastFetchAt: string | null;
  lastLog: {
    status: string;
    total: number;
    newCount: number;
    fetchedAt: string;
  } | null;
}

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-green-500',
  partial: 'bg-yellow-500',
  failed: 'bg-red-500',
};

export default function SourcesPage() {
  const { data, isLoading } = useSWR<ApiResponse<SourceInfo[]>>('/api/sources', fetcher, {
    refreshInterval: 30000,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">数据源状态</h1>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : data?.data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.data.map((source) => (
            <Card key={source.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{source.displayName}</CardTitle>
                  <div className="flex items-center gap-1">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        source.lastLog ? STATUS_COLORS[source.lastLog.status] ?? 'bg-gray-400' : 'bg-gray-400'
                      }`}
                    />
                    {source.isActive ? (
                      <Badge variant="default" className="text-[10px]">运行中</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">已暂停</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>类型：{source.type === 'rss' ? 'RSS' : source.type === 'rest_api' ? 'REST API' : '爬虫'}</p>
                {source.lastLog ? (
                  <div className="mt-2 space-y-1">
                    <p>最近采集：{new Date(source.lastLog.fetchedAt).toLocaleString('zh-CN')}</p>
                    <p>采集 {source.lastLog.total} 条，新增 {source.lastLog.newCount} 条</p>
                  </div>
                ) : (
                  <p className="mt-2">暂无采集记录</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-12">
          暂无已配置的数据源，请在 DataSource 表中添加
        </p>
      )}
    </div>
  );
}
