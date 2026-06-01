'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CarouselProps {
  children: React.ReactNode[];
  itemsPerView?: number;
}

export function Carousel({ children, itemsPerView = 3 }: CarouselProps) {
  const [start, setStart] = useState(0);
  const maxStart = Math.max(0, children.length - itemsPerView);

  const goLeft = () => setStart((s) => Math.max(0, s - itemsPerView));
  const goRight = () => setStart((s) => Math.min(maxStart, s + itemsPerView));

  if (children.length <= itemsPerView) {
    return (
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${itemsPerView}, 1fr)` }}
      >
        {children}
      </div>
    );
  }

  return (
    <div className="relative group">
      {start > 0 && (
        <Button
          variant="outline"
          size="icon"
          className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={goLeft}
          aria-label="上一个"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      <div
        className="grid gap-4 transition-all duration-300"
        style={{ gridTemplateColumns: `repeat(${itemsPerView}, 1fr)` }}
      >
        {children.slice(start, start + itemsPerView)}
      </div>

      {start < maxStart && (
        <Button
          variant="outline"
          size="icon"
          className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={goRight}
          aria-label="下一个"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      {/* 页码指示器 */}
      <div className="flex justify-center gap-1 mt-2">
        {Array.from({ length: Math.ceil(children.length / itemsPerView) }).map(
          (_, i) => (
            <button
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === Math.floor(start / itemsPerView)
                  ? 'w-4 bg-primary'
                  : 'w-1.5 bg-muted-foreground/30'
              }`}
              onClick={() => setStart(i * itemsPerView)}
              aria-label={`第 ${i + 1} 页`}
            />
          )
        )}
      </div>
    </div>
  );
}
