'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { RoadmapView } from '@/components/RoadmapView';
import { api } from '@/lib/api';

function RoadmapContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const productId = searchParams.get('product') ?? undefined;
  const lifecycleStatus = searchParams.get('lifecycle_status') ?? undefined;
  const ownerId = searchParams.get('owner_id') ?? undefined;
  const status = searchParams.get('status') ?? undefined;
  const category1 = searchParams.get('category_1') ?? undefined;
  const category2 = searchParams.get('category_2') ?? undefined;
  const category3 = searchParams.get('category_3') ?? undefined;
  const groupId = searchParams.get('group_id') ?? undefined;
  const ungroupedOnly = searchParams.get('ungrouped_only') === 'true';
  const productNameFilter = searchParams.get('product_name') ?? '';
  const dateFrom = searchParams.get('date_from') ?? '';
  const dateTo = searchParams.get('date_to') ?? '';

  const hasAdvancedFilter = productNameFilter.trim() !== '' || dateFrom !== '' || dateTo !== '';

  const filters =
    lifecycleStatus || ownerId || status || category1 || category2 || category3 || groupId || ungroupedOnly || productNameFilter.trim() || dateFrom || dateTo
      ? {
          lifecycle_status: lifecycleStatus,
          owner_id: ownerId,
          status,
          category_1: category1,
          category_2: category2,
          category_3: category3,
          group_id: groupId,
          ungrouped_only: ungroupedOnly ? true : undefined,
          product_name: productNameFilter.trim() || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        }
      : undefined;

  const listParams = {
    limit: 100,
    offset: 0,
    ...filters,
    ...(dateFrom && { date_from: dateFrom }),
    ...(dateTo && { date_to: dateTo }),
  };

  const { data: productsResult } = useQuery({
    queryKey: ['products', listParams],
    queryFn: () => api.products.list(listParams),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const fetchedProducts = productsResult?.items ?? [];
  const products = productNameFilter.trim()
    ? fetchedProducts.filter((p) =>
        p.name.toLowerCase().includes(productNameFilter.trim().toLowerCase())
      )
    : fetchedProducts;
  const { data: groups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.groups.list(),
    staleTime: 60 * 1000,
  });

  const { data: ungroupedResult } = useQuery({
    queryKey: ['products', { ungrouped_only: true, limit: 1, offset: 0 }],
    queryFn: () => api.products.list({ ungrouped_only: true, limit: 1, offset: 0 }),
    staleTime: 60 * 1000,
  });
  const hasUngroupedProducts = (ungroupedResult?.total ?? 0) > 0;

  const buildRoadmapUrl = useCallback(
    (overrides: Record<string, string | undefined>) => {
      const all: Record<string, string> = {
        product: productId ?? '',
        lifecycle_status: lifecycleStatus ?? '',
        owner_id: ownerId ?? '',
        status: status ?? '',
        category_1: category1 ?? '',
        category_2: category2 ?? '',
        category_3: category3 ?? '',
        group_id: groupId ?? '',
        ungrouped_only: ungroupedOnly ? 'true' : '',
        product_name: productNameFilter ?? '',
        date_from: dateFrom ?? '',
        date_to: dateTo ?? '',
        ...overrides,
      };
      const params = new URLSearchParams();
      Object.entries(all).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
      });
      const q = params.toString();
      return q ? `/roadmap?${q}` : '/roadmap';
    },
    [productId, lifecycleStatus, ownerId, status, category1, category2, category3, groupId, ungroupedOnly, productNameFilter, dateFrom, dateTo]
  );

  const setAdvancedFilter = (overrides: Record<string, string>) => {
    router.push(buildRoadmapUrl(overrides));
  };

  const clearAdvancedFilter = () => {
    router.push(buildRoadmapUrl({ product_name: '', date_from: '', date_to: '' }));
  };

  const selectedProductName = productId ? products.find((p) => p.id === productId)?.name : null;
  const selectedGroupName = groupId ? groups.find((g) => g.id === groupId)?.name : null;

  const breadcrumbItems: { label: string; href?: string }[] = [{ label: 'Roadmap', href: '/roadmap' }];
  if (selectedProductName) {
    breadcrumbItems.push({ label: `Product: ${selectedProductName}` });
  }
  if (ungroupedOnly && hasUngroupedProducts) {
    breadcrumbItems.push({ label: 'Group: No group' });
  } else if (selectedGroupName) {
    breadcrumbItems.push({ label: `Group: ${selectedGroupName}` });
  }
  if (productNameFilter.trim()) {
    breadcrumbItems.push({ label: `Name: ${productNameFilter.trim()}` });
  }
  if (dateFrom || dateTo) {
    breadcrumbItems.push({ label: dateFrom && dateTo ? `Date: ${dateFrom} – ${dateTo}` : dateFrom ? `From: ${dateFrom}` : `To: ${dateTo}` });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Breadcrumb: selected filters */}
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm">
            {breadcrumbItems.map((item, i) => (
              <li key={i} className="flex items-center gap-1.5">
                {i > 0 && (
                  <span className="text-slate-300 select-none" aria-hidden>
                    /
                  </span>
                )}
                {item.href ? (
                  <Link
                    href={item.href}
                    className="font-medium text-dhl-red hover:text-dhl-red/80 hover:underline focus:outline-none focus:ring-2 focus:ring-dhl-red focus:ring-offset-1 rounded"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-slate-600 font-medium">{item.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {/* Page header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Roadmap
          </h1>
          <p className="text-slate-500 mt-1">
            View product milestones by version. Filter by group or categories, or select a product.
          </p>

          {/* Product line first */}
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

          {/* Groups below Product line — Gantt reflects selected group */}
          <div className="mt-4 flex flex-wrap items-center gap-2 group/group-label">
            <span className="text-sm font-medium text-slate-600">Group:</span>
            <Link
              href="/groups"
              className="p-1 rounded text-dhl-red hover:bg-dhl-yellow/25 focus:outline-none focus:ring-2 focus:ring-dhl-red focus:ring-offset-1 opacity-0 transition-opacity group-hover/group-label:opacity-100"
              title="Edit groups"
              aria-label="Edit groups"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                <path d="m15 5 4 4" />
              </svg>
            </Link>
            <div className="flex flex-wrap gap-2">
              <Link
                href={buildRoadmapUrl({ group_id: '', ungrouped_only: '' })}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  !groupId && !ungroupedOnly ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All
              </Link>
              {hasUngroupedProducts && (
                <Link
                  href={buildRoadmapUrl({ group_id: '', ungrouped_only: 'true' })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    !groupId && ungroupedOnly ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  No group
                </Link>
              )}
              {groups.map((g) => (
                <Link
                  key={g.id}
                  href={buildRoadmapUrl({ group_id: g.id, ungrouped_only: '' })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      groupId === g.id && !ungroupedOnly ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                  {g.name} ({g.product_count})
                </Link>
              ))}
            </div>
          </div>

          {/* Advanced filter: product name + date range (closed by default; click to expand) */}
          <details
            className="group mt-4 rounded-xl border border-slate-200 bg-white/80 shadow-sm overflow-hidden"
          >
            <summary className="list-none cursor-pointer">
              <div className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/80 transition-colors">
                <span className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-200/80 text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 6h18M7 12h10M10 18h4" />
                    </svg>
                  </span>
                  <span className="font-semibold text-slate-800">Advanced filter</span>
                  {hasAdvancedFilter && (
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      Active
                    </span>
                  )}
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400 shrink-0 transition-transform group-open:rotate-180" aria-hidden>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </summary>
            <div className="px-4 pb-4 pt-1 border-t border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Product name</label>
                  <input
                    type="text"
                    value={productNameFilter}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAdvancedFilter({ product_name: v, date_from: dateFrom, date_to: dateTo });
                    }}
                    placeholder="Any"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400 w-full"
                    aria-label="Filter by product name"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Date from</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setAdvancedFilter({ product_name: productNameFilter, date_from: e.target.value, date_to: dateTo })}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400 w-full"
                    aria-label="Date from"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Date to</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setAdvancedFilter({ product_name: productNameFilter, date_from: dateFrom, date_to: e.target.value })}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400 w-full"
                    aria-label="Date to"
                  />
                </div>
                <div className="flex flex-col gap-1.5 justify-end">
                  {hasAdvancedFilter && (
                    <button
                      type="button"
                      onClick={clearAdvancedFilter}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
                    >
                      Clear filter
                    </button>
                  )}
                </div>
              </div>
            </div>
          </details>
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
