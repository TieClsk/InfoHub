'use client';

import { useState, useRef, useEffect } from 'react';
import useSWR from 'swr';
import { Loader2, Send, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface OverviewData {
  label: string;
  overview: string;
  items: Array<{ title: string; summary: string }>;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const CAT_ICONS: Record<string, string> = {
  domestic: '🔥', weibo: '💬', international: '🌍',
  ai: '🤖', github: '⭐', investment: '📈',
};

export default function OverviewPage() {
  const { data, isLoading } = useSWR<{ success: boolean; data: Record<string, OverviewData> }>(
    '/api/ai/overview',
    fetcher
  );

  // 右侧问答
  const [chat, setChat] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat]);

  const send = async (q: string) => {
    if (!q.trim() || sending) return;
    setInput('');
    setChat((c) => [...c, { role: 'user', content: q }]);
    setSending(true);
    try {
      // 构建上下文：所有速览内容
      const context = Object.values(data?.data || {}).map(
        (d) => `【${d.label}】\n${d.items.map((i) => `- ${i.title}: ${i.summary}`).join('\n')}`
      ).join('\n\n');

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'InfoHub 今日速览',
          summary: '',
          detailSummary: context.slice(0, 3000),
          question: q,
          history: chat,
        }),
      });
      const d = await res.json();
      setChat((c) => [...c, { role: 'assistant', content: d.data?.answer || '请求失败' }]);
    } catch {
      setChat((c) => [...c, { role: 'assistant', content: '请求失败，请重试' }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex gap-6">
      {/* 左侧速览 */}
      <div className="flex-1 min-w-0 space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">今日速览</h1>
        <p className="text-sm text-muted-foreground -mt-4">
          AI 综合各领域 Top 10 新闻，自动生成每日概要
        </p>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border rounded-xl p-4 space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : data?.data ? (
          Object.entries(data.data).map(([key, d]) => (
            <section key={key} className="border rounded-xl p-5">
              <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                <span>{CAT_ICONS[key] || '📌'}</span> {d.label}
              </h2>
              <p className="text-sm leading-relaxed whitespace-pre-line">{d.overview || '生成中...'}</p>
              {d.items.length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    查看 Top {d.items.length} 条来源
                  </summary>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {d.items.map((item, i) => (
                      <li key={i}>• {item.title}</li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          ))
        ) : null}
      </div>

      {/* 右侧问答 */}
      <div className="w-80 shrink-0 hidden lg:block">
        <div className="sticky top-20 border rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-1.5">
            <MessageCircle className="h-4 w-4" /> AI 问答
          </h3>
          <p className="text-xs text-muted-foreground">
            基于今日所有速览内容，可以询问"今天有什么大事"、"AI领域有什么突破"等
          </p>

          {/* 聊天记录 */}
          {chat.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {chat.map((m, i) => (
                <div key={i} className={`text-xs ${m.role === 'user' ? 'bg-muted rounded-lg px-2 py-1.5' : 'border rounded-lg px-2 py-1.5'}`}>
                  <span className="text-[10px] text-muted-foreground">{m.role === 'user' ? '你' : 'AI'}</span>
                  <p className="mt-0.5 leading-relaxed whitespace-pre-line">{m.content}</p>
                </div>
              ))}
              {sending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              <div ref={chatEnd} />
            </div>
          )}

          <div className="flex gap-1.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send(input)}
              placeholder="问点什么..."
              className="flex-1 text-xs rounded-lg border px-2.5 py-1.5 bg-background outline-none focus:border-ring"
              disabled={sending}
            />
            <Button size="icon" className="h-7 w-7 shrink-0" disabled={!input.trim() || sending} onClick={() => send(input)}>
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
