import { NextResponse } from 'next/server';
import { cleanupRawContent } from '@/lib/pipeline';

export async function GET() {
  const retentionDays = parseInt(process.env['RAW_RETENTION_DAYS'] ?? '14', 10);
  try {
    const { deleted } = await cleanupRawContent(retentionDays);

    // 清理后刷新速览
    const baseUrl = `${process.env['VERCEL_URL'] ? `https://${process.env['VERCEL_URL']}` : 'http://localhost:3000'}`;
    try { await fetch(`${baseUrl}/api/ai/overview`, { method: 'POST' }); } catch { /* ignore */ }

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown' } },
      { status: 500 }
    );
  }
}
