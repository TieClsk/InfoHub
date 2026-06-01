import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateDetailSummary, generateSuggestedQuestions } from '@/lib/deepseek';
import type { ApiResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { id } = (await request.json()) as { id: string };
    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Missing id' } },
        { status: 400 }
      );
    }

    // 查找 ProcessedContent
    const item = await prisma.processedContent.findUnique({
      where: { id },
      select: { id: true, title: true, summary: true, metadata: true },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Item not found' } },
        { status: 404 }
      );
    }

    // 检查是否已有缓存的详细概述
    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(item.metadata || '{}') as Record<string, unknown>;
    } catch { /* ignore */ }

    if (meta['detailedSummary']) {
      const questions = (meta['questions'] as string[]) ?? [];
      const response: ApiResponse<{
        detailedSummary: string;
        questions: string[];
        cached: boolean;
      }> = {
        success: true,
        data: {
          detailedSummary: meta['detailedSummary'] as string,
          questions,
          cached: true,
        },
      };
      return NextResponse.json(response);
    }

    // 调用 DeepSeek 生成
    const sourceUrl = meta['sourceUrl'] as string | undefined;
    const detailedSummary = await generateDetailSummary(
      item.title,
      item.summary,
      sourceUrl
    );

    if (!detailedSummary) {
      const response: ApiResponse<{
        detailedSummary: string;
        questions: string[];
        cached: boolean;
      }> = {
        success: true,
        data: { detailedSummary: '', questions: [], cached: false },
      };
      return NextResponse.json(response);
    }

    // 同时生成推荐问题
    const questions = await generateSuggestedQuestions(item.title, item.summary);

    // 缓存
    meta['detailedSummary'] = detailedSummary;
    meta['questions'] = questions;
    await prisma.processedContent.update({
      where: { id },
      data: { metadata: JSON.stringify(meta) },
    });

    const response: ApiResponse<{
      detailedSummary: string;
      questions: string[];
      cached: boolean;
    }> = {
      success: true,
      data: { detailedSummary, questions, cached: false },
    };
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
