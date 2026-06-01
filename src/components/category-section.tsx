'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Carousel } from './carousel';
import { NewsCard } from './news-card';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  sourceName: string;
  category: string;
  importance: number;
  tags: string;
  publishedAt: string;
  metadata: string | null;
}

interface CategorySectionProps {
  icon: string;
  label: string;
  items: NewsItem[];
  skeleton?: boolean;
}

const ITEMS_PER_PAGE = 3;

export function CategorySection({ icon, label, items, skeleton }: CategorySectionProps) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const start = page * ITEMS_PER_PAGE;

  if (skeleton || items.length === 0) {
    return (
      <section>
        <h2 className="text-lg font-semibold mb-3">{icon} {label}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 h-40 animate-pulse">
              <div className="h-3 w-20 bg-muted rounded mb-2" />
              <div className="h-4 w-full bg-muted rounded mb-2" />
              <div className="h-10 w-full bg-muted rounded" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section>
      {/* 标题栏：左侧标题 + 右侧箭头和页码 */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{icon} {label}</h2>
        <div className="flex items-center gap-2">
          {/* 页码指示器 */}
          <div className="flex items-center gap-1.5 mr-1">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === page
                    ? 'h-2 w-5 bg-primary'
                    : 'h-2 w-2 bg-muted-foreground/25 hover:bg-muted-foreground/50'
                }`}
                aria-label={`第 ${i + 1} 页`}
              />
            ))}
          </div>

          {/* 翻页按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md"
            disabled={page <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            aria-label="上一页"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums min-w-[2rem] text-center">
            {page + 1}/{totalPages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            aria-label="下一页"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 卡片区 */}
      <Carousel itemsPerView={ITEMS_PER_PAGE} start={start}>
        {items.map((item) => (
          <NewsCard
            key={item.id}
            id={item.id}
            title={item.title}
            summary={item.summary}
            sourceName={item.sourceName}
            category={item.category}
            importance={item.importance}
            tags={item.tags}
            publishedAt={item.publishedAt}
            metadata={item.metadata}
          />
        ))}
      </Carousel>
    </section>
  );
}
