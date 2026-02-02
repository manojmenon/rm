'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { RequireAuth } from '@/components/RequireAuth';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { getPendingCount } from '@/lib/requestUtils';

type StatItem = { label: string; value: number | string; href: string };

function useGlobalStats() {
  const q = (opts: Parameters<typeof api.products.list>[0]) =>
    api.products.list({ ...opts, limit: 1, offset: 0 });
  const total = useQuery({ queryKey: ['products', { limit: 1 }], queryFn: () => q({}), staleTime: 60 * 1000 });
  const active = useQuery({ queryKey: ['products', { lifecycle_status: 'active' }], queryFn: () => q({ lifecycle_status: 'active' }), staleTime: 60 * 1000 });
  const notActive = useQuery({ queryKey: ['products', { lifecycle_status: 'not_active' }], queryFn: () => q({ lifecycle_status: 'not_active' }), staleTime: 60 * 1000 });
  const suspend = useQuery({ queryKey: ['products', { lifecycle_status: 'suspend' }], queryFn: () => q({ lifecycle_status: 'suspend' }), staleTime: 60 * 1000 });
  const endOfRoadmap = useQuery({ queryKey: ['products', { lifecycle_status: 'end_of_roadmap' }], queryFn: () => q({ lifecycle_status: 'end_of_roadmap' }), staleTime: 60 * 1000 });
  return {
    total: total.data?.total ?? 0,
    active: active.data?.total ?? 0,
    notActive: notActive.data?.total ?? 0,
    suspend: suspend.data?.total ?? 0,
    endOfRoadmap: endOfRoadmap.data?.total ?? 0,
    loadingTotal: total.isLoading,
  };
}

function useMyStats(ownerId: string | undefined, enabled: boolean) {
  const base = { owner_id: ownerId ?? '', limit: 1, offset: 0 };
  const allow = !!ownerId && enabled;
  const total = useQuery({ queryKey: ['products', { ...base }], queryFn: () => api.products.list(base), enabled: allow, staleTime: 60 * 1000 });
  const active = useQuery({ queryKey: ['products', { ...base, lifecycle_status: 'active' }], queryFn: () => api.products.list({ ...base, lifecycle_status: 'active' }), enabled: allow, staleTime: 60 * 1000 });
  const archived = useQuery({ queryKey: ['products', { ...base, status: 'archived' }], queryFn: () => api.products.list({ ...base, status: 'archived' }), enabled: allow, staleTime: 60 * 1000 });
  const notActive = useQuery({ queryKey: ['products', { ...base, lifecycle_status: 'not_active' }], queryFn: () => api.products.list({ ...base, lifecycle_status: 'not_active' }), enabled: allow, staleTime: 60 * 1000 });
  const suspend = useQuery({ queryKey: ['products', { ...base, lifecycle_status: 'suspend' }], queryFn: () => api.products.list({ ...base, lifecycle_status: 'suspend' }), enabled: allow, staleTime: 60 * 1000 });
  const endOfRoadmap = useQuery({ queryKey: ['products', { ...base, lifecycle_status: 'end_of_roadmap' }], queryFn: () => api.products.list({ ...base, lifecycle_status: 'end_of_roadmap' }), enabled: allow, staleTime: 60 * 1000 });
  return {
    myTotal: total.data?.total ?? 0,
    active: active.data?.total ?? 0,
    archived: archived.data?.total ?? 0,
    notActive: notActive.data?.total ?? 0,
    suspend: suspend.data?.total ?? 0,
    endOfRoadmap: endOfRoadmap.data?.total ?? 0,
  };
}

function DashboardContent() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = (() => { const r = user?.role?.toLowerCase(); return r === 'admin' || r === 'superadmin'; })();
  const [tableSearchOpen, setTableSearchOpen] = useState(false);
  const [filterUser, setFilterUser] = useState('');

  const globalStats = useGlobalStats();

  // Stagger second wave (my stats, users, pending, etc.) to avoid 429 burst with global stats
  const [secondWave, setSecondWave] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSecondWave(true), 500);
    return () => clearTimeout(t);
  }, []);

  const myStats = useMyStats(user?.id, secondWave);

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.list(),
    enabled: isAdmin && secondWave,
    staleTime: 60 * 1000,
  });

  const filteredUsers = useMemo(() => {
    if (!filterUser.trim()) return users;
    const q = filterUser.trim().toLowerCase();
    return users.filter((u) => u.name.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q));
  }, [users, filterUser]);

  // Stagger per-user stats so we don't burst 5*N requests and hit rate limit (429)
  const [perUserStatsUnlocked, setPerUserStatsUnlocked] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPerUserStatsUnlocked(true), 1200);
    return () => clearTimeout(t);
  }, []);

  const { data: creationRequests } = useQuery({
    queryKey: ['product-requests'],
    queryFn: () => api.requests.list(),
    enabled: secondWave,
    staleTime: 60 * 1000,
  });
  const { data: deletionRequests } = useQuery({
    queryKey: ['deletion-requests'],
    queryFn: () => api.deletionRequests.list(),
    enabled: isAdmin && secondWave,
    staleTime: 60 * 1000,
  });
  const { data: pendingProductsResult } = useQuery({
    queryKey: ['products', { status: 'pending', limit: 1 }],
    queryFn: () => api.products.list({ status: 'pending', limit: 1, offset: 0 }),
    enabled: secondWave,
    staleTime: 60 * 1000,
  });
  const pendingProductsCount = pendingProductsResult?.total ?? 0;
  const pendingCount =
    getPendingCount(creationRequests, deletionRequests) + pendingProductsCount;

  const myBase = user?.id ? `/products?owner_id=${encodeURIComponent(user.id)}` : '/products';

  return (
    <div className="min-h-[60vh] flex flex-col items-center px-4 pb-10">
      <h1 className="text-2xl font-bold text-slate-800 tracking-tight mb-6">Dashboard</h1>
      <div className="w-full max-w-5xl space-y-6">
        {/* Summary table: Global + My row */}
        <div className="rounded-xl border-2 border-dhl-red/30 bg-white shadow-sm overflow-hidden">
          <table className="w-full min-w-[520px]">
            <thead className="bg-dhl-yellow/25 border-b-2 border-dhl-red/40">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-dhl-red">Scope</th>
                <th className="text-right px-4 py-3 font-medium text-dhl-red">Total</th>
                <th className="text-right px-4 py-3 font-medium text-dhl-red">Active</th>
                <th className="text-right px-4 py-3 font-medium text-dhl-red">Not active</th>
                <th className="text-right px-4 py-3 font-medium text-dhl-red">Suspended</th>
                <th className="text-right px-4 py-3 font-medium text-dhl-red">End of roadmap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dhl-red/20">
              <tr className="hover:bg-dhl-yellow/10">
                <td className="px-4 py-3 text-sm font-medium text-slate-800">Global</td>
                <td className="px-4 py-3 text-right">
                  <Link href="/products" className="text-dhl-red hover:underline font-medium tabular-nums">
                    {globalStats.loadingTotal ? '—' : globalStats.total}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href="/products?lifecycle_status=active" className="text-dhl-red hover:underline tabular-nums">{globalStats.active}</Link>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href="/products?lifecycle_status=not_active" className="text-dhl-red hover:underline tabular-nums">{globalStats.notActive}</Link>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href="/products?lifecycle_status=suspend" className="text-dhl-red hover:underline tabular-nums">{globalStats.suspend}</Link>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href="/products?lifecycle_status=end_of_roadmap" className="text-dhl-red hover:underline tabular-nums">{globalStats.endOfRoadmap}</Link>
                </td>
              </tr>
              <tr className="hover:bg-dhl-yellow/10 bg-dhl-yellow/15">
                <td className="px-4 py-3 text-sm font-medium text-slate-800">My products</td>
                <td className="px-4 py-3 text-right">
                  <Link href={myBase} className="text-dhl-red hover:underline font-medium tabular-nums">{myStats.myTotal}</Link>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`${myBase}&lifecycle_status=active`} className="text-dhl-red hover:underline tabular-nums">{myStats.active}</Link>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`${myBase}&lifecycle_status=not_active`} className="text-dhl-red hover:underline tabular-nums">{myStats.notActive}</Link>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`${myBase}&lifecycle_status=suspend`} className="text-dhl-red hover:underline tabular-nums">{myStats.suspend}</Link>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`${myBase}&lifecycle_status=end_of_roadmap`} className="text-dhl-red hover:underline tabular-nums">{myStats.endOfRoadmap}</Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Admin: Per-user table with in-table filter */}
        {isAdmin && (
          <div className="rounded-xl border-2 border-dhl-red/30 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b-2 border-dhl-red/40 bg-dhl-yellow/25 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-dhl-red uppercase tracking-wide">Per user (admin)</h2>
              {pendingCount > 0 && (
                <span className="text-amber-700 text-sm font-medium">Pending: {pendingCount}</span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-dhl-yellow/25 border-b-2 border-dhl-red/40">
                  <tr>
                    <th className="text-left px-4 py-3 w-12">
                      <button
                        type="button"
                        onClick={() => setTableSearchOpen((o) => !o)}
                        className={`p-1.5 rounded transition-colors ${tableSearchOpen ? 'bg-dhl-yellow text-dhl-red' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}
                        aria-label={tableSearchOpen ? 'Hide table filters' : 'Show table filters'}
                        title={tableSearchOpen ? 'Hide filters' : 'Filter table'}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8" />
                          <path d="m21 21-4.35-4.35" />
                        </svg>
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-dhl-red w-12">#</th>
                    <th className="text-left px-4 py-3 font-medium text-dhl-red">User</th>
                    <th className="text-right px-4 py-3 font-medium text-dhl-red">Total</th>
                    <th className="text-right px-4 py-3 font-medium text-dhl-red">I own</th>
                    <th className="text-right px-4 py-3 font-medium text-dhl-red">Archived</th>
                    <th className="text-right px-4 py-3 font-medium text-dhl-red">Not active</th>
                    <th className="text-right px-4 py-3 font-medium text-dhl-red">Suspended</th>
                    <th className="text-right px-4 py-3 font-medium text-dhl-red">End of roadmap</th>
                  </tr>
                  {tableSearchOpen && (
                    <tr className="bg-dhl-yellow/15 border-b border-dhl-red/30">
                      <th className="px-4 py-2" />
                      <th className="px-4 py-2" />
                      <th className="px-4 py-2">
                        <input
                          type="text"
                          value={filterUser}
                          onChange={(e) => setFilterUser(e.target.value)}
                          placeholder="Filter by user name or email…"
                          className="w-full rounded border border-dhl-red/40 px-2 py-1.5 text-sm focus:ring-2 focus:ring-dhl-red focus:border-dhl-red"
                          aria-label="Filter by user"
                        />
                      </th>
                      <th className="px-4 py-2" />
                      <th className="px-4 py-2" />
                      <th className="px-4 py-2" />
                      <th className="px-4 py-2" />
                      <th className="px-4 py-2" />
                      <th className="px-4 py-2" />
                      <th className="px-4 py-2" />
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-dhl-red/20">
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500 text-sm">
                        Loading users…
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500 text-sm">
                        {users.length === 0 ? 'No users.' : 'No users match the filter.'}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u, index) => (
                      <PerUserRow
                        key={u.id}
                        user={u}
                        index={index}
                        enableStats={perUserStatsUnlocked || index < 8}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PerUserRow({
  user,
  index,
  enableStats,
}: {
  user: { id: string; name: string };
  index: number;
  enableStats: boolean;
}) {
  const queries = useQueries({
    queries: [
      { queryKey: ['products', { owner_id: user.id, limit: 1 }], queryFn: () => api.products.list({ owner_id: user.id, limit: 1, offset: 0 }), staleTime: 60 * 1000, enabled: enableStats },
      { queryKey: ['products', { owner_id: user.id, status: 'archived', limit: 1 }], queryFn: () => api.products.list({ owner_id: user.id, status: 'archived', limit: 1, offset: 0 }), staleTime: 60 * 1000, enabled: enableStats },
      { queryKey: ['products', { owner_id: user.id, lifecycle_status: 'not_active', limit: 1 }], queryFn: () => api.products.list({ owner_id: user.id, lifecycle_status: 'not_active', limit: 1, offset: 0 }), staleTime: 60 * 1000, enabled: enableStats },
      { queryKey: ['products', { owner_id: user.id, lifecycle_status: 'suspend', limit: 1 }], queryFn: () => api.products.list({ owner_id: user.id, lifecycle_status: 'suspend', limit: 1, offset: 0 }), staleTime: 60 * 1000, enabled: enableStats },
      { queryKey: ['products', { owner_id: user.id, lifecycle_status: 'end_of_roadmap', limit: 1 }], queryFn: () => api.products.list({ owner_id: user.id, lifecycle_status: 'end_of_roadmap', limit: 1, offset: 0 }), staleTime: 60 * 1000, enabled: enableStats },
    ],
  });
  const total = queries[0]?.data?.total ?? 0;
  const archived = queries[1]?.data?.total ?? 0;
  const notActive = queries[2]?.data?.total ?? 0;
  const suspend = queries[3]?.data?.total ?? 0;
  const endOfRoadmap = queries[4]?.data?.total ?? 0;
  const base = `/products?owner_id=${encodeURIComponent(user.id)}`;

  return (
    <tr className="hover:bg-dhl-yellow/10">
      <td className="px-4 py-3 w-12" />
      <td className="px-4 py-3 text-slate-500 text-sm tabular-nums w-12">{index + 1}</td>
      <td className="px-4 py-3">
        <Link href={base} className="text-sm font-medium text-dhl-red hover:text-dhl-red/80 hover:underline">
          {user.name}
        </Link>
      </td>
      <td className="px-4 py-3 text-right">
        <Link href={base} className="text-dhl-red hover:underline text-sm tabular-nums">{total}</Link>
      </td>
      <td className="px-4 py-3 text-right">
        <Link href={base} className="text-dhl-red hover:underline text-sm tabular-nums">{total}</Link>
      </td>
      <td className="px-4 py-3 text-right">
        <Link href={`${base}&status=archived`} className="text-dhl-red hover:underline text-sm tabular-nums">{archived}</Link>
      </td>
      <td className="px-4 py-3 text-right">
        <Link href={`${base}&lifecycle_status=not_active`} className="text-dhl-red hover:underline text-sm tabular-nums">{notActive}</Link>
      </td>
      <td className="px-4 py-3 text-right">
        <Link href={`${base}&lifecycle_status=suspend`} className="text-dhl-red hover:underline text-sm tabular-nums">{suspend}</Link>
      </td>
      <td className="px-4 py-3 text-right">
        <Link href={`${base}&lifecycle_status=end_of_roadmap`} className="text-dhl-red hover:underline text-sm tabular-nums">{endOfRoadmap}</Link>
      </td>
    </tr>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
