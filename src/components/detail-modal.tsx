'use client';

import { useEffect, useState, useRef } from 'react';
import { Star, ExternalLink, X, Tag, Loader2, Send, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface DetailModalProps {
  open: boolean;
  onClose: () => void;
  id?: string;
  title: string;
  summary: string;
  sourceName: string;
  category: string;
  importance: number;
  tags: string[] | string;
  publishedAt: string;
  sourceUrl?: string | null;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  domestic: '国内',
  international: '国际',
  ai: 'AI',
  github: 'GitHub',
  investment: '投资',
};

function parseTags(tags: string[] | string): string[] {
  if (Array.isArray(tags)) return tags;
  try {
    const parsed: unknown = JSON.parse(tags || '[]');
    return Array.isArray(parsed) ? parsed as string[] : [];
  } catch {
    return [];
  }
}

export function DetailModal({
  open,
  onClose,
  id,
  title,
  summary,
  sourceName,
  category,
  importance,
  tags,
  publishedAt,
  sourceUrl,
}: DetailModalProps) {
  const [detail, setDetail] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);

  // Chat state
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !id) return;
    setDetail('');
    setDetailLoading(true);
    setChatHistory([]);
    setInput('');
    setQuestions([]);

    fetch('/api/ai/detail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          setDetail(data.data.detailedSummary || '');
          setQuestions(data.data.questions || []);
        }
      })
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, [open, id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, sending]);

  const sendQuestion = async (question: string) => {
    if (!question.trim() || sending) return;
    const q = question.trim();
    setInput('');
    setChatHistory((h) => [...h, { role: 'user', content: q }]);
    setSending(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          summary,
          detailSummary: detail,
          question: q,
          history: chatHistory,
        }),
      });
      const data = (await res.json()) as {
        success: boolean;
        data?: { answer: string };
      };
      if (data.success && data.data?.answer) {
        setChatHistory((h) => [...h, { role: 'assistant', content: data.data!.answer }]);
      }
    } catch {
      setChatHistory((h) => [...h, { role: 'assistant', content: '抱歉，请求失败，请重试。' }]);
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  const tagList = parseTags(tags);
  const date = new Date(publishedAt).toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-background rounded-xl shadow-lg max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 border">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-md hover:bg-muted transition-colors z-10"
          aria-label="关闭"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="space-y-4">
          {/* 标题和元信息 */}
          <h2 className="text-lg font-semibold leading-snug pr-8">{title}</h2>
          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            <Badge variant="secondary">{CATEGORY_LABELS[category] ?? category}</Badge>
            <span>{sourceName}</span>
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="text-amber-500 font-medium">{importance}</span>/10
            </span>
            <time>{date}</time>
          </div>
          {tagList.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tagList.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  <Tag className="h-3 w-3 mr-1" />{tag}
                </Badge>
              ))}
            </div>
          )}

          {/* AI 摘要 */}
          <div>
            <h3 className="text-sm font-medium mb-1">AI 摘要</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
          </div>

          {/* 深度概述 */}
          {detailLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              AI 正在生成深度概述...
            </div>
          )}
          {detail && (
            <div>
              <h3 className="text-sm font-medium mb-1">深度概述</h3>
              <p className="text-sm leading-relaxed whitespace-pre-line">{detail}</p>
            </div>
          )}

          {/* AI 问答区 — 深度概述完成后显示 */}
          {detail && (
            <div className="border-t pt-4 space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-1.5">
                <MessageCircle className="h-4 w-4" />
                AI 问答
              </h3>

              {/* 聊天记录 */}
              {chatHistory.length > 0 && (
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {chatHistory.map((msg, i) => (
                    <div
                      key={i}
                      className={`text-sm ${
                        msg.role === 'user'
                          ? 'bg-muted rounded-lg px-3 py-2 ml-4'
                          : 'border rounded-lg px-3 py-2 mr-4'
                      }`}
                    >
                      <p className="text-xs text-muted-foreground mb-0.5">
                        {msg.role === 'user' ? '你' : 'AI'}
                      </p>
                      <p className="leading-relaxed whitespace-pre-line">{msg.content}</p>
                    </div>
                  ))}
                  {sending && (
                    <div className="border rounded-lg px-3 py-2 mr-4 text-sm">
                      <p className="text-xs text-muted-foreground mb-0.5">AI</p>
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}

              {/* 推荐问题 */}
              {chatHistory.length === 0 && questions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">你可能想问：</p>
                  {questions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendQuestion(q)}
                      className="block w-full text-left text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg px-3 py-2 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* 输入框 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendQuestion(input)}
                  placeholder={chatHistory.length > 0 ? '继续提问...' : '输入你的问题...'}
                  className="flex-1 text-sm rounded-lg border px-3 py-2 bg-background outline-none focus:border-ring"
                  disabled={sending}
                />
                <Button
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  disabled={!input.trim() || sending}
                  onClick={() => sendQuestion(input)}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              查看原文
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
