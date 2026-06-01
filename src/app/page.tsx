export const dynamic = 'force-dynamic';

import { CategorySection } from '@/components/category-section';

const CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: 'domestic', label: '热点新闻', icon: '🔥' },
  { key: 'weibo', label: '微博舆论', icon: '💬' },
  { key: 'international', label: '国际热点', icon: '🌍' },
  { key: 'ai', label: 'AI 动态', icon: '🤖' },
  { key: 'github', label: 'GitHub 热榜', icon: '⭐' },
  { key: 'investment', label: '投资资讯', icon: '📈' },
];

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

async function getCategoryNews() {
  try {
    const { prisma } = await import('@/lib/db');
    const queries = CATEGORIES.map((cat) =>
      prisma.processedContent.findMany({
        where: { category: cat.key },
        orderBy: { importance: 'desc' },
        take: 12,
      })
    );
    const results = await Promise.all(queries);
    const map: Record<string, NewsItem[]> = {};
    CATEGORIES.forEach((cat, i) => { map[cat.key] = results[i] as unknown as NewsItem[]; });
    return map;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const news = await getCategoryNews();

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">信息聚合</h1>
        <p className="text-muted-foreground mt-1">多源采集 · AI 精选 · 每日更新</p>
      </section>

      {CATEGORIES.map((cat) => (
        <CategorySection
          key={cat.key}
          icon={cat.icon}
          label={cat.label}
          items={news?.[cat.key] ?? []}
          skeleton={!news}
        />
      ))}
    </div>
  );
}
