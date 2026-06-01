import { NextRequest, NextResponse } from 'next/server';
import { chatAboutContent } from '@/lib/deepseek';
import type { ApiResponse } from '@/types';

interface ChatRequest {
  title: string;
  summary: string;
  detailSummary: string;
  question: string;
  history: Array<{ role: string; content: string }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequest;
    if (!body.question?.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Missing question' } },
        { status: 400 }
      );
    }

    const answer = await chatAboutContent(
      body.title,
      body.summary,
      body.detailSummary || '',
      body.question,
      body.history || []
    );

    const response: ApiResponse<{ answer: string }> = {
      success: true,
      data: { answer },
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
