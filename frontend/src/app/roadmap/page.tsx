'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { RequireAuth } from '@/components/RequireAuth';
import { RoadmapView } from '@/components/RoadmapView';
import { api } from '@/lib/api';

function RoadmapContent() {
  const searchParams = useSearchParams();
  const productId = searchParams.get('product') ?? undefined;
  const lifecycleStatus = searchParams.get('lifecycle_status') ?? undefined;
  const ownerId = searchParams.get('owner_id') ?? undefined;
  const status = searchParams.get('status') ?? undefined;
  const category1 = searchParams.get('category_1') ?? undefined;
  const category2 = searchParams.get('category_2') ?? undefined;
  const category3 = searchParams.get('category_3') ?? undefined;
  const groupId = searchParams.get('group_id') ?? undefined;
  const filters =
    lifecycleStatus || ownerId || status || category1 || category2 || category3 || groupId
      ? { lifecycle_status: lifecycleStatus, owner_id: ownerId, status, category_1: category1, category_2: category2, category_3: category3, group_id: groupId }
      : undefined;

  const { data: productsResult } = useQuery({
    queryKey: ['products', { limit: 100, ...filters }],
    queryFn: () => api.products.list({ limit: 100, offset: 0, ...filters }),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const products = productsResult?.items ?? [];
  const { data: groups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.groups.list(),
    staleTime: 60 * 1000,
  });

  const buildRoadmapUrl = (overrides: Record<string, string | undefined>) => {
    const all: Record<string, string> = {
      product: productId ?? '',
      lifecycle_status: lifecycleStatus ?? '',
      owner_id: ownerId ?? '',
      status: status ?? '',
      category_1: category1 ?? '',
      category_2: category2 ?? '',
      category_3: category3 ?? '',
      group_id: groupId ?? '',
      ...overrides,
    };
    const params = new URLSearchParams();
    Object.entries(all).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });
    const q = params.toString();
    return q ? `/roadmap?${q}` : '/roadmap';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Page header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Roadmap
          </h1>
          <p className="text-slate-500 mt-1">
            View product milestones by version. Filter by group or categories, or select a product.
          </p>

          {groups.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-600">Group:</span>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={buildRoadmapUrl({ group_id: '' })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    !groupId ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  No group
                </Link>
                {groups.map((g) => (
                  <Link
                    key={g.id}
                    href={buildRoadmapUrl({ group_id: g.id })}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      groupId === g.id ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {g.name} ({g.product_count})
                  </Link>
                ))}
              </div>
            </div>
          )}

          {products.length > 1 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-600">Product:</span>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={buildRoadmapUrl({ product: '' })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    !productId ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All
                </Link>
                {products.map((p) => (
                  <Link
                    key={p.id}
                    href={buildRoadmapUrl({ product: p.id })}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      productId === p.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {p.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </header>

        <RoadmapView productId={productId} filters={filters} />
      </div>
    </div>
  );
}

export default function RoadmapPage() {
  return (
    <RequireAuth>
      <RoadmapContent />
    </RequireAuth>
  );
}
