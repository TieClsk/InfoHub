import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { WeeklyContent } from './weekly-content';

export default function WeeklyPage() {
  return (
    <Suspense fallback={<WeeklyFallback />}>
      <WeeklyContent />
    </Suspense>
  );
}

function WeeklyFallback() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">周报</h1>
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}
