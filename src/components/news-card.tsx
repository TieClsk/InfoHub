import { Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface NewsCardProps {
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
  domestic: '国内',
  international: '国际',
  ai: 'AI',
  github: 'GitHub',
  investment: '投资',
};

export function NewsCard({
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
  const url = getSourceUrl(metadata, sourceUrl);
  const date = new Date(publishedAt).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {CATEGORY_LABELS[category] ?? category}
            </Badge>
            <span>{sourceName}</span>
          </div>
          <div className="flex items-center gap-0.5 shrink-0" title={`AI 评分 ${importance}/10`}>
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="text-amber-500 font-medium ml-0.5">{importance}</span>
            <span className="text-[10px]">/10</span>
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
            title
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2">{summary}</p>
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
  );
}
