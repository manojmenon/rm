'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';

export default function HomePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (accessToken && user) {
      router.replace('/dashboard');
      return;
    }
    // Wait for persist rehydration before redirecting to login
    const t = setTimeout(() => {
      setChecked(true);
      if (!useAuthStore.getState().accessToken && !useAuthStore.getState().user) {
        router.replace('/login');
      }
    }, 200);
    return () => clearTimeout(t);
  }, [user, accessToken, router]);

  // Valid token → redirect to dashboard
  if (user && accessToken) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <p className="text-gray-500">Redirecting to dashboard...</p>
      </div>
    );
  }
  // After rehydration, no token → redirect to sign-in
  if (checked && !user && !accessToken) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <p className="text-gray-500">Redirecting to sign in...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto text-center py-16">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">
        Product Roadmap Management
      </h1>
      <p className="text-lg text-gray-600 mb-8">
        Plan, visualize, and track product lifecycles across multi-year roadmaps.
      </p>
      <div className="flex gap-4 justify-center flex-wrap">
        <Link href="/dashboard" className="btn-primary">
          Dashboard
        </Link>
        <Link href="/products" className="btn-secondary">
          Products
        </Link>
        <Link href="/roadmap" className="btn-secondary">
          Roadmap View
        </Link>
      </div>
    </div>
  );
}
