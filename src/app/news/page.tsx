import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { NewsContent } from './news-content';

export default function NewsPage() {
  return (
    <Suspense fallback={<NewsFallback />}>
      <NewsContent />
    </Suspense>
  );
}

function NewsFallback() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">新闻列表</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    </div>
  );
}
