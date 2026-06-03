'use client';

import useSWR from 'swr';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DateStripProps {
  selected: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  category?: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function DateStrip({ selected, onChange, category }: DateStripProps) {
  const catParam = category ? `?category=${category}` : '';
  const { data } = useSWR<{ success: boolean; data: string[] }>(
    `/api/news/dates${catParam}`,
    fetcher,
    { dedupingInterval: 60000 }
  );

  const availableDates = new Set(data?.data || []);
  const selectedDate = selected || new Date().toISOString().slice(0, 10);

  // 生成前后15天的日期列表
  const today = new Date();
  const dates: string[] = [];
  for (let i = -15; i <= 0; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {dates.map((d) => {
        const hasNews = availableDates.has(d);
        const today = new Date().toISOString().slice(0, 10);
        const y = new Date(); y.setDate(y.getDate() - 1);
        const yesterday = y.toISOString().slice(0, 10);
        const isToday = d === today;
        const isYesterday = d === yesterday;
        const isSelected = d === selectedDate;

        return (
          <button
            key={d}
            onClick={() => hasNews && onChange(d)}
            disabled={!hasNews}
            className={`shrink-0 flex flex-col items-center px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
              isSelected
                ? 'bg-primary text-primary-foreground font-medium'
                : hasNews
                  ? 'hover:bg-muted text-foreground'
                  : 'text-muted-foreground/30 cursor-not-allowed'
            }`}
          >
            <span className="text-[10px] opacity-70">{d.slice(5)}</span>
            <span className={`text-[10px] ${isToday || isYesterday ? 'font-bold' : ''}`}>
              {isToday ? '今天' : isYesterday ? '昨天' : formatDay(d)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  return `周${days[d.getDay()]}`;
}
