import { NextRequest, NextResponse } from 'next/server';

const CATEGORIES = ['domestic', 'weibo', 'international', 'ai', 'github', 'investment'];

export async function GET(request: NextRequest) {
  const baseUrl = request.nextUrl.origin;

  // 触发异步采集（独立进程，不阻塞返回）
  fetch(`${baseUrl}/api/cron/fetch`, ).catch(() => {});

  // 触发各板块 AI 处理（每个独立进程）
  for (const cat of CATEGORIES) {
    fetch(`${baseUrl}/api/cron/process?category=${cat}`, ).catch(() => {});
  }

  // 触发清理
  fetch(`${baseUrl}/api/cron/cleanup`, ).catch(() => {});

  // 立即返回，不等待任何异步操作
  return NextResponse.json({ success: true, message: 'queued' });
}
