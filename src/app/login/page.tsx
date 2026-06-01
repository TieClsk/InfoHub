'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      router.push('/guestbook');
    } else {
      setError('账号或密码错误');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-sm mx-auto mt-20">
      <h1 className="text-xl font-bold mb-4">管理员登录</h1>
      <form onSubmit={handleLogin} className="space-y-4">
        {error && <p className="text-sm text-red-500">{error}</p>}
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="用户名"
          className="w-full text-sm rounded-lg border px-3 py-2 bg-background outline-none focus:border-ring"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="密码"
          className="w-full text-sm rounded-lg border px-3 py-2 bg-background outline-none focus:border-ring"
        />
        <Button type="submit" disabled={!username || !password || loading} className="w-full">
          {loading ? '登录中...' : '登录'}
        </Button>
      </form>
    </div>
  );
}
