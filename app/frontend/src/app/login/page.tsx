'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  // If already logged in with valid token, go to dashboard
  useEffect(() => {
    if (user && accessToken) {
      router.replace('/dashboard');
    }
  }, [user, accessToken, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login({ email, password });
      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  if (user && accessToken) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <p className="text-gray-500">Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto card mt-12">
      <h2 className="text-2xl font-semibold mb-6">Sign in</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-2 rounded space-y-1">
            <p>{error}</p>
            {(error.includes('500') || error.includes('Server error') || error.includes('Backend')) && (
              <p className="text-xs text-gray-600 mt-1">
                Check: <code className="bg-red-100 px-1">docker compose logs backend</code> and DevTools → Network → failed request → Response tab.
              </p>
            )}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            required
          />
        </div>
        <button type="submit" className="btn-primary w-full">
          Sign in
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        No account? <Link href="/register" className="text-blue-600 hover:underline">Register</Link>
      </p>
    </div>
  );
}
