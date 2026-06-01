import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { ApiResponse } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.guestbook.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.guestbook.count(),
    ]);

    const response: ApiResponse<typeof data> = { success: true, data, meta: { page, limit, total } };
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { content, author } = (await request.json()) as { content: string; author?: string };
    if (!content?.trim() || content.length > 500) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: '内容1-500字' } },
        { status: 400 }
      );
    }

    const item = await prisma.guestbook.create({
      data: { content: content.trim(), author: author?.trim() || '匿名' },
    });

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id } = (await request.json()) as { id: string };
    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Missing id' } },
        { status: 400 }
      );
    }

    const item = await prisma.guestbook.update({
      where: { id },
      data: { likes: { increment: 1 } },
    });

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } },
      { status: 500 }
    );
  }
}
