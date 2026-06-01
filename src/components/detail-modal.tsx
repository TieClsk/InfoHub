'use client';

import { Star, ExternalLink, X, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface DetailModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  summary: string;
  sourceName: string;
  category: string;
  importance: number;
  tags: string[] | string;
  publishedAt: string;
  sourceUrl?: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  domestic: '国内',
  international: '国际',
  ai: 'AI',
  github: 'GitHub',
  investment: '投资',
};

function parseTags(tags: string[] | string): string[] {
  if (Array.isArray(tags)) return tags;
  try {
    const parsed: unknown = JSON.parse(tags || '[]');
    return Array.isArray(parsed) ? parsed as string[] : [];
  } catch {
    return [];
  }
}

export function DetailModal({
  open,
  onClose,
  title,
  summary,
  sourceName,
  category,
  importance,
  tags,
  publishedAt,
  sourceUrl,
}: DetailModalProps) {
  if (!open) return null;

  const tagList = parseTags(tags);
  const date = new Date(publishedAt).toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* 弹窗 */}
      <div className="relative bg-background rounded-xl shadow-lg max-w-lg w-full max-h-[80vh] overflow-y-auto p-6 border">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-md hover:bg-muted transition-colors"
          aria-label="关闭"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="space-y-4">
          {/* 标题 */}
          <h2 className="text-lg font-semibold leading-snug pr-8">{title}</h2>

          {/* 元信息 */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            <Badge variant="secondary">
              {CATEGORY_LABELS[category] ?? category}
            </Badge>
            <span>{sourceName}</span>
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="text-amber-500 font-medium">{importance}</span>
              /10
            </span>
            <time>{date}</time>
          </div>

          {/* 标签 */}
          {tagList.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tagList.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  <Tag className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* 摘要 */}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-sm leading-relaxed whitespace-pre-line">{summary}</p>
          </div>

          {/* 链接 */}
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-2"
            >
              <ExternalLink className="h-4 w-4" />
              查看原文
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
