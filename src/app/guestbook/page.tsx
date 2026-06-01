'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Heart, Send, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface Message {
  id: string;
  content: string;
  author: string;
  likes: number;
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function GuestbookPage() {
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [liked, setLiked] = useState<Set<string>>(new Set());

  const { data, isLoading } = useSWR<{ success: boolean; data: Message[]; meta: { total: number } }>(
    '/api/guestbook',
    fetcher
  );

  const handleSubmit = async () => {
    if (!content.trim() || content.length > 500 || submitting) return;
    setSubmitting(true);
    await fetch('/api/guestbook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.trim(), author: author.trim() || undefined }),
    });
    setContent('');
    setAuthor('');
    setSubmitting(false);
    mutate('/api/guestbook');
  };

  const handleLike = async (id: string) => {
    if (liked.has(id)) return;
    setLiked((s) => new Set(s).add(id));
    await fetch('/api/guestbook', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    mutate('/api/guestbook');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">留言板</h1>
      <p className="text-sm text-muted-foreground -mt-4">反馈问题、提出建议，公开可见</p>

      {/* 提交区 */}
      <div className="space-y-3 border rounded-xl p-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="写下你的反馈或建议..."
          maxLength={500}
          rows={3}
          className="w-full text-sm rounded-lg border px-3 py-2 bg-background outline-none focus:border-ring resize-none"
        />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="昵称（选填）"
              maxLength={20}
              className="flex-1 text-xs rounded-lg border px-2 py-1.5 bg-background outline-none focus:border-ring"
            />
          </div>
          <span className="text-[10px] text-muted-foreground">{content.length}/500</span>
          <Button size="sm" disabled={!content.trim() || submitting} onClick={handleSubmit}>
            <Send className="h-3.5 w-3.5 mr-1" />
            提交
          </Button>
        </div>
      </div>

      {/* 留言列表 */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : data?.data?.length ? (
        <div className="space-y-3">
          {data.data.map((msg) => (
            <div key={msg.id} className="border rounded-xl p-4">
              <p className="text-sm leading-relaxed whitespace-pre-line">{msg.content}</p>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" /> {msg.author}
                  </span>
                  <time>{new Date(msg.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
                </div>
                <button
                  onClick={() => handleLike(msg.id)}
                  disabled={liked.has(msg.id)}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${
                    liked.has(msg.id) ? 'text-red-400 cursor-default' : 'text-muted-foreground hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950'
                  }`}
                >
                  <Heart className={`h-3.5 w-3.5 ${liked.has(msg.id) ? 'fill-red-400' : ''}`} />
                  {msg.likes}
                </button>
              </div>
            </div>
          ))}
          {data.meta && (
            <p className="text-xs text-muted-foreground text-center">共 {data.meta.total} 条留言</p>
          )}
        </div>
      ) : (
        <p className="text-center text-muted-foreground py-8">暂无留言，来说点什么吧</p>
      )}
    </div>
  );
}
