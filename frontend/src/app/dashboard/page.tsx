'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { RequireAuth } from '@/components/RequireAuth';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { getPendingCount } from '@/lib/requestUtils';

function DashboardContent() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const { data: totalResult, isLoading: loadingTotal } = useQuery({
    queryKey: ['products', { limit: 1, offset: 0 }],
    queryFn: () => api.products.list({ limit: 1, offset: 0 }),
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
  });
  const { data: activeResult } = useQuery({
    queryKey: ['products', { lifecycle_status: 'active', limit: 1, offset: 0 }],
    queryFn: () => api.products.list({ lifecycle_status: 'active', limit: 1, offset: 0 }),
    staleTime: 60 * 1000,
  });
  const { data: notActiveResult } = useQuery({
    queryKey: ['products', { lifecycle_status: 'not_active', limit: 1, offset: 0 }],
    queryFn: () => api.products.list({ lifecycle_status: 'not_active', limit: 1, offset: 0 }),
    staleTime: 60 * 1000,
  });
  const { data: suspendResult } = useQuery({
    queryKey: ['products', { lifecycle_status: 'suspend', limit: 1, offset: 0 }],
    queryFn: () => api.products.list({ lifecycle_status: 'suspend', limit: 1, offset: 0 }),
    staleTime: 60 * 1000,
  });
  const { data: endOfRoadmapResult } = useQuery({
    queryKey: ['products', { lifecycle_status: 'end_of_roadmap', limit: 1, offset: 0 }],
    queryFn: () => api.products.list({ lifecycle_status: 'end_of_roadmap', limit: 1, offset: 0 }),
    staleTime: 60 * 1000,
  });
  const { data: ownedResult } = useQuery({
    queryKey: ['products', { owner_id: user?.id ?? '', limit: 1, offset: 0 }],
    queryFn: () => api.products.list({ owner_id: user?.id ?? '', limit: 1, offset: 0 }),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });
  const { data: archivedResult } = useQuery({
    queryKey: ['products', { status: 'archived', limit: 1, offset: 0 }],
    queryFn: () => api.products.list({ status: 'archived', limit: 1, offset: 0 }),
    staleTime: 60 * 1000,
  });
  const { data: creationRequests } = useQuery({
    queryKey: ['product-requests'],
    queryFn: () => api.requests.list(),
    staleTime: 60 * 1000,
  });
  const { data: deletionRequests } = useQuery({
    queryKey: ['deletion-requests'],
    queryFn: () => api.deletionRequests.list(),
    enabled: isAdmin,
    staleTime: 60 * 1000,
  });
  const { data: pendingProductsResult } = useQuery({
    queryKey: ['products', { status: 'pending', limit: 1, offset: 0 }],
    queryFn: () => api.products.list({ status: 'pending', limit: 1, offset: 0 }),
    staleTime: 60 * 1000,
  });
  const pendingProductsCount = pendingProductsResult?.total ?? 0;
  const pendingCount =
    getPendingCount(creationRequests, deletionRequests) + pendingProductsCount;

  const totalProducts = totalResult?.total ?? 0;
  const activeProducts = activeResult?.total ?? 0;
  const notActiveProducts = notActiveResult?.total ?? 0;
  const suspendProducts = suspendResult?.total ?? 0;
  const endOfRoadmapProducts = endOfRoadmapResult?.total ?? 0;
  const productsIOwn = ownedResult?.total ?? 0;
  const archivedProducts = archivedResult?.total ?? 0;

  const lifecycleGroups: { label: string; value: number; href: string }[] = [
    { label: 'Active', value: activeProducts, href: '/products?lifecycle_status=active' },
    { label: 'Not active', value: notActiveProducts, href: '/products?lifecycle_status=not_active' },
    { label: 'Suspended', value: suspendProducts, href: '/products?lifecycle_status=suspend' },
    { label: 'End of roadmap', value: endOfRoadmapProducts, href: '/products?lifecycle_status=end_of_roadmap' },
  ];

  const topStats: { label: string; value: string | number; href: string }[] = [
    { label: 'Total', value: loadingTotal ? '—' : totalProducts, href: '/products' },
    { label: 'Archived', value: archivedProducts, href: '/products?status=archived' },
    { label: 'That I own', value: productsIOwn, href: user?.id ? `/products?owner_id=${encodeURIComponent(user.id)}` : '/products' },
  ];

  return (
    <div className="min-h-[60vh]">
      <h1 className="text-3xl font-bold text-slate-800 tracking-tight mb-8">Dashboard</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="group block bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300/80 transition-all duration-200 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-800">Products</h2>
              {pendingCount > 0 && (
                <span
                  className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-full text-xs font-semibold text-white bg-amber-500 shadow-sm"
                  aria-label={`${pendingCount} pending`}
                >
                  {pendingCount}
                </span>
              )}
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {topStats.map(({ label, value, href }) => (
                  <Link
                    key={label}
                    href={href}
                    className="rounded-xl bg-slate-50/80 border border-slate-100 px-4 py-3 group-hover:bg-slate-100/80 transition-colors hover:border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                  >
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
                    <p className="text-xl font-semibold text-slate-800 mt-0.5 tabular-nums">
                      {value}
                    </p>
                  </Link>
                ))}
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">By lifecycle</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {lifecycleGroups.map(({ label, value, href }) => (
                    <Link
                      key={label}
                      href={href}
                      className="rounded-xl bg-slate-50/80 border border-slate-100 px-4 py-3 group-hover:bg-slate-100/80 transition-colors hover:border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                    >
                      <p className="text-sm font-medium text-slate-700">{label}</p>
                      <p className="text-xl font-semibold text-slate-800 mt-0.5 tabular-nums">
                        {value}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-sm text-slate-500 mt-4">
              <Link href="/products" className="text-indigo-600 hover:text-indigo-700 font-medium">
                View and manage products →
              </Link>
            </p>
          </div>
        </div>
        <Link
          href="/roadmap"
          className="group block bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300/80 transition-all duration-200 overflow-hidden"
        >
          <div className="p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Roadmap</h2>
            <p className="text-slate-600 text-sm">Timeline & Gantt view</p>
            <p className="text-sm text-slate-500 mt-4">Open roadmap →</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
