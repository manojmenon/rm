'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth';

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60 * 1000 },
        },
      })
  );

  // Sync persisted token to localStorage after rehydration
  useEffect(() => {
    const token = useAuthStore.getState().accessToken;
    if (token && typeof window !== 'undefined') {
      localStorage.setItem('access_token', token);
    }
  }, []);

  // On 401 (expired/invalid token): clear auth and redirect to Sign-in
  useEffect(() => {
    const handleUnauthorized = () => {
      useAuthStore.getState().logout();
      router.replace('/login');
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
