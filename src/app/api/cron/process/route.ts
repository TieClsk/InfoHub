import { NextRequest, NextResponse } from 'next/server';
import { processCategory } from '@/lib/pipeline';

export async function GET(request: NextRequest) {
  const category = new URL(request.url).searchParams.get('category') || 'domestic';

  try {
    const result = await processCategory(category, 60);
    return NextResponse.json({ success: true, category, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown' } },
      { status: 500 }
    );
  }
}
