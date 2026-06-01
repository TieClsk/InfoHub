import { NextRequest, NextResponse } from 'next/server';
import { createToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const { username, password } = (await request.json()) as { username: string; password: string };

  const adminUser = process.env['ADMIN_USERNAME'] || 'admin';
  const adminPass = process.env['ADMIN_PASSWORD'] || 'infohub2025';

  if (username === adminUser && password === adminPass) {
    const token = await createToken(username);
    const response = NextResponse.json({ success: true });
    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      maxAge: 86400,
    });
    return response;
  }

  return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: '账号或密码错误' } }, { status: 401 });
}
