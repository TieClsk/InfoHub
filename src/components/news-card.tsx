'use client';

import { useState } from 'react';
import { Star, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DetailModal } from './detail-modal';

interface NewsCardProps {
  id?: string;
  title: string;
  summary: string;
  sourceName: string;
  category: string;
  importance: number;
  tags: string[] | string;
  publishedAt: string;
  sourceUrl?: string | null;
  metadata?: string | null;
}

function parseTags(tags: string[] | string): string[] {
  if (Array.isArray(tags)) return tags;
  try {
    const parsed: unknown = JSON.parse(tags || '[]');
    return Array.isArray(parsed) ? parsed as string[] : [];
  } catch {
    return [];
  }
}

function getSourceUrl(metadata?: string | null, sourceUrl?: string | null): string | null {
  if (sourceUrl) return sourceUrl;
  if (metadata) {
    try {
      const meta = JSON.parse(metadata) as { sourceUrl?: string };
      return meta.sourceUrl ?? null;
    } catch { /* ignore */ }
  }
  return null;
}

const CATEGORY_LABELS: Record<string, string> = {
  domestic: '热点',
  weibo: '微博',
  international: '国际',
  ai: 'AI',
  github: 'GitHub',
  investment: '投资',
};

export function NewsCard({
  id,
  title,
  summary,
  sourceName,
  category,
  importance,
  tags,
  publishedAt,
  sourceUrl,
  metadata,
}: NewsCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const url = getSourceUrl(metadata, sourceUrl);

  // 解析来源数量 + GitHub 今日星数
  let sourceCount = 0;
  let sourceNames: string[] = [];
  let todayStars = 0;
  if (metadata) {
    try {
      const meta = JSON.parse(metadata) as {
        sourceCount?: number; sourceNames?: string[]; sourceRank?: number;
      };
      sourceCount = meta.sourceCount ?? 0;
      sourceNames = meta.sourceNames ?? [];
      todayStars = meta.sourceRank ?? 0;
    } catch { /* ignore */ }
  }
  const date = new Date(publishedAt).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <>
      <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {CATEGORY_LABELS[category] ?? category}
              </Badge>
              {sourceCount > 1 ? (
                <span
                  className="text-[10px] text-green-600 dark:text-green-400 font-medium"
                  title={sourceNames.join('、')}
                >
                  {sourceCount} 家媒体
                </span>
              ) : (
                <span>{sourceName}</span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {category === 'github' && todayStars > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground" title="今日 Star 数">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{todayStars}</span>
                  <span>今日</span>
                </span>
              )}
              <span className="flex items-center gap-0.5" title={`AI 评分 ${importance}/10`}>
                <Sparkles className="h-3 w-3 text-purple-400" />
                <span className="text-purple-500 font-medium">{importance}</span>
                <span className="text-[10px]">/10</span>
              </span>
            </div>
          </div>
          <CardTitle className="text-base leading-snug mt-1">
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline decoration-muted-foreground/30"
              >
                {title}
              </a>
            ) : (
              <span
                className="cursor-pointer hover:text-primary transition-colors"
                onClick={() => setDetailOpen(true)}
              >
                {title}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className="text-sm text-muted-foreground line-clamp-2 cursor-pointer hover:text-foreground transition-colors"
            onClick={() => setDetailOpen(true)}
            title="点击查看详情"
          >
            {summary}
          </p>
          <div className="flex items-center justify-between mt-3">
            <div className="flex gap-1 flex-wrap">
              {parseTags(tags).slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
            </div>
            <time className="text-xs text-muted-foreground">{date}</time>
          </div>
        </CardContent>
      </Card>

      <DetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        id={id}
        title={title}
        summary={summary}
        sourceName={sourceName}
        category={category}
        importance={importance}
        tags={tags}
        publishedAt={publishedAt}
        sourceUrl={url}
      />
    </>
  );
}
