'use client';

interface CarouselProps {
  children: React.ReactNode[];
  itemsPerView?: number;
  start: number;
}

export function Carousel({ children, itemsPerView = 3, start }: CarouselProps) {
  if (children.length <= itemsPerView) {
    return (
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${itemsPerView}, 1fr)` }}
      >
        {children.map((child, i) => (
          <div
            key={i}
            className="animate-fade-in-up"
            style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'backwards' }}
          >
            {child}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${itemsPerView}, 1fr)` }}
    >
      {children.slice(start, start + itemsPerView).map((child, i) => (
        <div
          key={start + i}
          className="animate-fade-in-up"
          style={{
            animationDelay: `${i * 100}ms`,
            animationFillMode: 'backwards',
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
