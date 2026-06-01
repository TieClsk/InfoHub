'use client';

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

export function CategorySection({ icon, label, items, skeleton }: CategorySectionProps) {
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
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{icon} {label}</h2>
        <span className="text-xs text-muted-foreground">{items.length} 条</span>
      </div>
      <Carousel itemsPerView={3}>
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
