import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getTokenFromCookie } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = getTokenFromCookie(request.headers.get('cookie'));
  if (!token) return NextResponse.json({ success: true, data: { loggedIn: false } });

  const user = await verifyToken(token);
  return NextResponse.json({ success: true, data: { loggedIn: !!user, username: user?.username } });
}
