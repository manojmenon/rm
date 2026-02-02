'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { RequireAuth } from '@/components/RequireAuth';
import { api } from '@/lib/api';
import {
  type DateRangePresetOrAll,
  type DateRangeFilters,
  DATE_RANGE_PRESET_OPTIONS_WITH_ALL,
  getDateRangeForPreset,
  getDefaultDateRange,
} from '@/lib/dateRangePresets';
import { useAuthStore } from '@/store/auth';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 200;

type PendingRowEdits = { status?: string; lifecycle_status?: string; owner_id?: string | null };
type ConfirmEditProduct = { product: { id: string; name: string; version: string }; pending: PendingRowEdits };

type ColumnFilters = {
  name: string;
  version: string;
  status: string;
  lifecycle: string;
  owner: string;
};
const defaultColumnFilters: ColumnFilters = {
  name: '',
  version: '',
  status: '',
  lifecycle: '',
  owner: '',
};

function isPendingStatus(s: string | undefined): boolean {
  return (s ?? '').toLowerCase() === 'pending';
}

function productStatusLabel(s: string | undefined): string {
  const l = (s ?? '').toLowerCase();
  if (l === 'pending') return 'Pending';
  if (l === 'approved') return 'Approved';
  if (l === 'archived') return 'Archived';
  return s || '—';
}

function normalizeProductStatus(s: string | undefined): 'pending' | 'approved' | 'archived' {
  const l = (s ?? '').toLowerCase();
  if (l === 'approved') return 'approved';
  if (l === 'archived') return 'archived';
  return 'pending';
}

function matchesColumnFilters(
  p: { name: string; version?: string; status: string; lifecycle_status: string; owner?: { name: string }; owner_id?: string },
  pending: PendingRowEdits | undefined,
  users: { id: string; name: string }[],
  filters: ColumnFilters
): boolean {
  const statusDisplay = pending?.status ?? p.status;
  const lifecycleDisplay = pending?.lifecycle_status ?? p.lifecycle_status;
  const ownerName =
    p.owner?.name ?? (p.owner_id ? users.find((u) => u.id === p.owner_id)?.name : null) ?? '—';
  if (filters.name && !p.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
  if (filters.version && !(p.version ?? '').toLowerCase().includes(filters.version.toLowerCase())) return false;
  if (filters.status && !statusDisplay.toLowerCase().includes(filters.status.toLowerCase())) return false;
  if (filters.lifecycle && !lifecycleDisplay.toLowerCase().includes(filters.lifecycle.toLowerCase())) return false;
  if (filters.owner && !String(ownerName).toLowerCase().includes(filters.owner.toLowerCase())) return false;
  return true;
}

function ProductsContent() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [customPageSizeInput, setCustomPageSizeInput] = useState('');
  const [filterStatus, setFilterStatus] = useState(() => searchParams.get('status') ?? '');
  const [filterOwnerId, setFilterOwnerId] = useState(() => searchParams.get('owner_id') ?? '');
  const [filterLifecycle, setFilterLifecycle] = useState(() => searchParams.get('lifecycle_status') ?? '');
  const [filterCategory1, setFilterCategory1] = useState(() => searchParams.get('category_1') ?? '');
  const [filterCategory2, setFilterCategory2] = useState(() => searchParams.get('category_2') ?? '');
  const [filterCategory3, setFilterCategory3] = useState(() => searchParams.get('category_3') ?? '');
  const [filterGroupId, setFilterGroupId] = useState(() => searchParams.get('group_id') ?? '');
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePresetOrAll>('all');

  useEffect(() => {
    setFilterStatus(searchParams.get('status') ?? '');
    setFilterOwnerId(searchParams.get('owner_id') ?? '');
    setFilterLifecycle(searchParams.get('lifecycle_status') ?? '');
    setFilterCategory1(searchParams.get('category_1') ?? '');
    setFilterCategory2(searchParams.get('category_2') ?? '');
    setFilterCategory3(searchParams.get('category_3') ?? '');
    setFilterGroupId(searchParams.get('group_id') ?? '');
  }, [searchParams]);
  const [dateRange, setDateRange] = useState<DateRangeFilters>(getDefaultDateRange);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>(defaultColumnFilters);
  const [tableSearchOpen, setTableSearchOpen] = useState(false);
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [confirmDeletionProductId, setConfirmDeletionProductId] = useState<string | null>(null);
  const [confirmDeletionRequestId, setConfirmDeletionRequestId] = useState<string | null>(null);
  const [confirmDeletionProductName, setConfirmDeletionProductName] = useState('');
  const [confirmDeletionTyped, setConfirmDeletionTyped] = useState('');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [pendingEditsByProductId, setPendingEditsByProductId] = useState<Record<string, PendingRowEdits>>({});
  const [confirmEditProduct, setConfirmEditProduct] = useState<ConfirmEditProduct | null>(null);
  const [confirmProductNameTyped, setConfirmProductNameTyped] = useState('');
  const [confirmVersionTyped, setConfirmVersionTyped] = useState('');
  const isAdmin = (() => { const r = user?.role?.toLowerCase(); return r === 'admin' || r === 'superadmin'; })();

  const effectiveDateRange =
    dateRangePreset === 'all'
      ? null
      : dateRangePreset === 'custom'
        ? dateRange
        : getDateRangeForPreset(dateRangePreset);

  const effectiveLimit = Math.min(PAGE_SIZE_MAX, Math.max(1, pageSize));
  const pageSizeSelectValue = PAGE_SIZE_OPTIONS.includes(effectiveLimit as (typeof PAGE_SIZE_OPTIONS)[number])
    ? effectiveLimit
    : 'custom';

  const { data: groups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.groups.list(),
    staleTime: 60 * 1000,
  });
  const { data: result, isLoading } = useQuery({
    queryKey: [
      'products',
      {
        limit: effectiveLimit,
        offset,
        status: filterStatus || undefined,
        owner_id: filterOwnerId || undefined,
        lifecycle_status: filterLifecycle || undefined,
        category_1: filterCategory1 || undefined,
        category_2: filterCategory2 || undefined,
        category_3: filterCategory3 || undefined,
        group_id: filterGroupId || undefined,
        date_from: effectiveDateRange?.dateFrom,
        date_to: effectiveDateRange?.dateTo,
        sort_by: sortBy,
        order: sortOrder,
      },
    ],
    queryFn: () =>
      api.products.list({
        limit: effectiveLimit,
        offset,
        ...(filterStatus && { status: filterStatus }),
        ...(filterOwnerId && { owner_id: filterOwnerId }),
        ...(filterLifecycle && { lifecycle_status: filterLifecycle }),
        ...(filterCategory1 && { category_1: filterCategory1 }),
        ...(filterCategory2 && { category_2: filterCategory2 }),
        ...(filterCategory3 && { category_3: filterCategory3 }),
        ...(filterGroupId && { group_id: filterGroupId }),
        ...(effectiveDateRange && {
          date_from: effectiveDateRange.dateFrom,
          date_to: effectiveDateRange.dateTo,
        }),
        sort_by: sortBy,
        order: sortOrder,
      }),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const productsRaw = result?.items ?? [];
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.list(),
    enabled: true,
    staleTime: 0,
  });
  const { data: deletionRequests = [] } = useQuery({
    queryKey: ['deletion-requests'],
    queryFn: () => api.deletionRequests.list({ status: 'pending' }),
    enabled: isAdmin,
    staleTime: 0,
  });
  const pendingDeletionByProductId = useMemo(() => {
    const map = new Map<string, { id: string }>();
    deletionRequests.forEach((r) => {
      if (isPendingStatus(r.status)) map.set(r.product_id, { id: r.id });
    });
    return map;
  }, [deletionRequests]);
  const products = productsRaw.filter((p) =>
    matchesColumnFilters(p, pendingEditsByProductId[p.id], users, columnFilters)
  );
  const pendingProducts = products.filter(
    (p) => isPendingStatus(p.status) || (isAdmin && pendingDeletionByProductId.has(p.id))
  );
  const otherProducts = products.filter(
    (p) => !isPendingStatus(p.status) && (!isAdmin || !pendingDeletionByProductId.has(p.id))
  );

  const productIds = useMemo(
    () => [...pendingProducts, ...otherProducts].map((p) => p.id),
    [pendingProducts, otherProducts]
  );
  const [versionQueriesRevealCount, setVersionQueriesRevealCount] = useState(12);
  useEffect(() => {
    if (productIds.length === 0) return;
    setVersionQueriesRevealCount(12);
    const t = setTimeout(() => setVersionQueriesRevealCount(productIds.length), 1200);
    return () => clearTimeout(t);
  }, [productIds.length]);
  const versionQueries = useQueries({
    queries: productIds.map((id, index) => ({
      queryKey: ['product-versions', id],
      queryFn: () => api.productVersions.listByProduct(id),
      staleTime: 60 * 1000,
      enabled: index < versionQueriesRevealCount,
    })),
  });
  const versionEntries = useMemo(() => {
    return productIds.flatMap((id, i) =>
      (versionQueries[i]?.data ?? []).map((v: { id: string }) => ({ productId: id, versionId: v.id }))
    );
  }, [productIds, versionQueries]);
  const [depQueriesRevealCount, setDepQueriesRevealCount] = useState(15);
  useEffect(() => {
    if (versionEntries.length === 0) return;
    setDepQueriesRevealCount(15);
    const t = setTimeout(() => setDepQueriesRevealCount(versionEntries.length), 1200);
    return () => clearTimeout(t);
  }, [versionEntries.length]);
  const depQueries = useQueries({
    queries: versionEntries.map((ve, index) => ({
      queryKey: ['product-version-deps', ve.versionId],
      queryFn: () => api.productVersionDependencies.listByProductVersion(ve.versionId),
      enabled: !!ve.versionId && index < depQueriesRevealCount,
      staleTime: 60 * 1000,
    })),
  });
  const productIdToSerial = useMemo(
    () => new Map(productIds.map((id, i) => [id, i + 1])),
    [productIds]
  );
  const dependencyInfo = useMemo(() => {
    const isDependent = new Set<string>();
    const hasDependency = new Set<string>();
    const relatedSerialsByProductId = new Map<string, number[]>();
    productIds.forEach((id) => relatedSerialsByProductId.set(id, []));
    depQueries.forEach((q, idx) => {
      const deps = q.data ?? [];
      const ve = versionEntries[idx];
      if (!ve) return;
      const sourceProductId = ve.productId;
      deps.forEach((d: { target_product_id: string }) => {
        const tgtId = d.target_product_id;
        if (productIds.includes(sourceProductId)) {
          hasDependency.add(sourceProductId);
          const serial = productIdToSerial.get(tgtId);
          if (serial != null) {
            const arr = relatedSerialsByProductId.get(sourceProductId)!;
            if (!arr.includes(serial)) arr.push(serial);
          }
        }
        if (productIds.includes(tgtId)) {
          isDependent.add(tgtId);
          const serial = productIdToSerial.get(sourceProductId);
          if (serial != null) {
            const arr = relatedSerialsByProductId.get(tgtId)!;
            if (!arr.includes(serial)) arr.push(serial);
          }
        }
      });
    });
    productIds.forEach((id) => {
      const arr = relatedSerialsByProductId.get(id)!;
      arr.sort((a, b) => a - b);
    });
    return {
      isDependent,
      hasDependency,
      relatedSerialsByProductId,
      productIdToSerial,
    };
  }, [productIds, versionEntries, depQueries, productIdToSerial]);

  const [highlightedSerials, setHighlightedSerials] = useState<Set<number> | null>(null);
  const [superscriptPinned, setSuperscriptPinned] = useState(false);

  const ROW_BGS = ['bg-white', 'bg-slate-50/60', 'bg-blue-50/40', 'bg-emerald-50/40', 'bg-amber-50/40', 'bg-violet-50/40'];
  const getRowBg = (serial: number) => ROW_BGS[(serial - 1) % ROW_BGS.length];

  const handleSort = (sortKey: string) => {
    setSortBy(sortKey);
    setSortOrder((o) => (sortBy === sortKey ? (o === 'asc' ? 'desc' : 'asc') : 'asc'));
    setOffset(0);
  };
  const SortableTh = ({ label, sortKey }: { label: string; sortKey: string }) => (
    <th className="text-left px-4 py-3 font-medium text-dhl-red">
      <button
        type="button"
        onClick={() => handleSort(sortKey)}
        className="flex items-center gap-1 hover:text-dhl-red/80 focus:outline-none focus:ring-2 focus:ring-dhl-red focus:ring-offset-1 rounded"
      >
        {label}
        {sortBy === sortKey && (
          <span className="text-xs" aria-hidden>{sortOrder === 'asc' ? '↑' : '↓'}</span>
        )}
      </button>
    </th>
  );
  const setDateRangePresetAndRange = (preset: DateRangePresetOrAll, range?: DateRangeFilters) => {
    setDateRangePreset(preset);
    if (preset === 'all') return;
    if (preset === 'custom' && range) setDateRange(range);
    else if (preset !== 'custom') setDateRange(getDateRangeForPreset(preset));
  };

  const hasActiveFilters =
    !!filterStatus ||
    !!filterOwnerId ||
    !!filterLifecycle ||
    !!filterCategory1 ||
    !!filterCategory2 ||
    !!filterCategory3 ||
    !!filterGroupId ||
    dateRangePreset !== 'all' ||
    Object.values(columnFilters).some((v) => v.trim() !== '');
  const clearAllFilters = () => {
    setFilterStatus('');
    setFilterOwnerId('');
    setFilterLifecycle('');
    setFilterCategory1('');
    setFilterCategory2('');
    setFilterCategory3('');
    setFilterGroupId('');
    setDateRangePreset('all');
    setDateRange(getDefaultDateRange());
    setColumnFilters(defaultColumnFilters);
    setOffset(0);
  };
  const setColumnFilter = (key: keyof ColumnFilters, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  };

  const rejectPendingDeletionForProduct = (productId: string) => {
    const pendingId = pendingDeletionByProductId.get(productId)?.id;
    if (pendingId) {
      api.deletionRequests.approve(pendingId, { approved: false }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['deletion-requests'] });
      });
    }
  };

  const applyEditMutation = useMutation({
    mutationFn: ({
      id,
      pending,
    }: {
      id: string;
      pending: PendingRowEdits;
    }) => {
      const body: Parameters<typeof api.products.update>[1] = {};
      if (pending.status != null) body.status = pending.status;
      if (pending.lifecycle_status != null) body.lifecycle_status = pending.lifecycle_status;
      if (pending.owner_id !== undefined) {
        if (pending.owner_id === null) body.clear_owner = true;
        else body.owner_id = pending.owner_id;
      }
      return api.products.update(id, body);
    },
    onSuccess: (data, variables) => {
      closeEditConfirmModal();
      if (data && variables.id) {
        queryClient.setQueryData(['product', variables.id], data);
      }
      rejectPendingDeletionForProduct(variables.id);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const approveDeletionMutation = useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) =>
      api.deletionRequests.approve(id, { approved }),
    onSuccess: async () => {
      setConfirmDeletionProductId(null);
      setConfirmDeletionRequestId(null);
      setConfirmDeletionTyped('');
      setConfirmDeletionProductName('');
      queryClient.invalidateQueries({ queryKey: ['deletion-requests'] });
      await queryClient.refetchQueries({ queryKey: ['products'] });
    },
  });

  const openConfirmDeletion = (productId: string, requestId: string, productName: string) => {
    setConfirmDeletionProductId(productId);
    setConfirmDeletionRequestId(requestId);
    setConfirmDeletionProductName(productName);
    setConfirmDeletionTyped('');
  };

  const closeConfirmDeletion = () => {
    setConfirmDeletionProductId(null);
    setConfirmDeletionRequestId(null);
    setConfirmDeletionProductName('');
    setConfirmDeletionTyped('');
  };

  const handleConfirmArchive = () => {
    if (!confirmDeletionRequestId) return;
    if (confirmDeletionTyped.trim() !== (confirmDeletionProductName || '').trim()) return;
    approveDeletionMutation.mutate({ id: confirmDeletionRequestId, approved: true });
  };

  const closeEditConfirmModal = () => {
    setConfirmEditProduct(null);
    setConfirmProductNameTyped('');
    setConfirmVersionTyped('');
  };

  const handleConfirmEditApply = () => {
    if (!confirmEditProduct) return;
    const { product, pending } = confirmEditProduct;
    const nameMatch = confirmProductNameTyped.trim() === (product.name || '').trim();
    const versionMatch = confirmVersionTyped.trim() === (product.version || '').trim();
    if (!nameMatch || !versionMatch) return;
    applyEditMutation.mutate({ id: product.id, pending });
  };

  const handleRowLeave = (p: { id: string; name: string; version: string }) => {
    if (editingProductId !== p.id) return;
    const pending = pendingEditsByProductId[p.id];
    if (pending && Object.keys(pending).length > 0) {
      setConfirmEditProduct({
        product: { id: p.id, name: p.name, version: p.version || '' },
        pending: { ...pending },
      });
      setConfirmProductNameTyped('');
      setConfirmVersionTyped('');
      setPendingEditsByProductId((prev) => {
        const next = { ...prev };
        delete next[p.id];
        return next;
      });
      setEditingProductId(null);
    }
    // Do not clear editingProductId when there are no pending edits, so the user can stay in edit mode
  };

  const handleToggleEditMode = (p: { id: string; name: string; version: string }) => {
    if (editingProductId === p.id) {
      const pending = pendingEditsByProductId[p.id];
      if (pending && Object.keys(pending).length > 0) {
        setConfirmEditProduct({
          product: { id: p.id, name: p.name, version: p.version || '' },
          pending: { ...pending },
        });
        setConfirmProductNameTyped('');
        setConfirmVersionTyped('');
        setPendingEditsByProductId((prev) => {
          const next = { ...prev };
          delete next[p.id];
          return next;
        });
      }
      setEditingProductId(null);
    } else {
      setEditingProductId(p.id);
    }
  };

  const handleCancelEdit = (productId: string) => {
    setEditingProductId(null);
    setPendingEditsByProductId((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const isEditConfirmValid =
    confirmEditProduct &&
    confirmProductNameTyped.trim() === (confirmEditProduct.product.name || '').trim() &&
    confirmVersionTyped.trim() === (confirmEditProduct.product.version || '').trim();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Products</h1>
        <Link href="/products/new" className="btn-primary">New product</Link>
      </div>

      <details className="mb-6 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white shadow-sm overflow-hidden" open={hasActiveFilters}>
        <summary className="font-semibold cursor-pointer text-slate-800 list-none flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 transition-colors">
          <span className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-200/80 text-slate-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 6h18M7 12h10M10 18h4" />
              </svg>
            </span>
            Advanced filters
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearAllFilters(); }}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-200/80 hover:bg-slate-300 hover:text-slate-800 transition-colors"
            >
              Clear filters
            </button>
          )}
        </summary>
        <div className="px-5 pb-5 pt-1 border-t border-slate-100">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Date range</label>
              <select
                value={dateRangePreset}
                onChange={(e) => {
                  const preset = e.target.value as DateRangePresetOrAll;
                  setDateRangePresetAndRange(preset, preset === 'custom' ? dateRange : undefined);
                  setOffset(0);
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400 w-full"
                aria-label="Date range preset"
              >
                {DATE_RANGE_PRESET_OPTIONS_WITH_ALL.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {dateRangePreset === 'custom' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Date from</label>
                  <input
                    type="date"
                    value={dateRange.dateFrom}
                    onChange={(e) => {
                      setDateRange((prev) => ({ ...prev, dateFrom: e.target.value }));
                      setOffset(0);
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                    aria-label="Date from"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Date to</label>
                  <input
                    type="date"
                    value={dateRange.dateTo}
                    onChange={(e) => {
                      setDateRange((prev) => ({ ...prev, dateTo: e.target.value }));
                      setOffset(0);
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                    aria-label="Date to"
                  />
                </div>
              </>
            )}
            {dateRangePreset !== 'all' && dateRangePreset !== 'custom' && (
              <div className="flex flex-col gap-1.5 text-sm text-slate-600 col-span-2 sm:col-span-1">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Range</span>
                <span>
                  {effectiveDateRange?.dateFrom} – {effectiveDateRange?.dateTo}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); setOffset(0); }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400 w-full"
                aria-label="Filter by status"
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Lifecycle</label>
              <select
                value={filterLifecycle}
                onChange={(e) => { setFilterLifecycle(e.target.value); setOffset(0); }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400 w-full"
                aria-label="Filter by lifecycle"
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="not_active">Not active</option>
                <option value="suspend">Suspended</option>
                <option value="end_of_roadmap">End of roadmap</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Owner</label>
              <select
                value={filterOwnerId}
                onChange={(e) => { setFilterOwnerId(e.target.value); setOffset(0); }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400 w-full"
                aria-label="Filter by owner"
              >
                <option value="">All</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Category 1</label>
              <input
                type="text"
                value={filterCategory1}
                onChange={(e) => { setFilterCategory1(e.target.value); setOffset(0); }}
                placeholder="Any"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400 w-full"
                aria-label="Filter by category 1"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Category 2</label>
              <input
                type="text"
                value={filterCategory2}
                onChange={(e) => { setFilterCategory2(e.target.value); setOffset(0); }}
                placeholder="Any"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400 w-full"
                aria-label="Filter by category 2"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Category 3</label>
              <input
                type="text"
                value={filterCategory3}
                onChange={(e) => { setFilterCategory3(e.target.value); setOffset(0); }}
                placeholder="Any"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400 w-full"
                aria-label="Filter by category 3"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Group</label>
              <select
                value={filterGroupId}
                onChange={(e) => { setFilterGroupId(e.target.value); setOffset(0); }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400 w-full"
                aria-label="Filter by group"
              >
                <option value="">All</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name} ({g.product_count})</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </details>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="rounded-xl border-2 border-dhl-red/30 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto -mx-px">
            <table className="w-full min-w-[640px]">
            <thead className="bg-dhl-yellow/25 border-b-2 border-dhl-red/40">
              <tr>
                <th className="text-left px-4 py-3 font-medium w-10">
                  <button
                    type="button"
                    onClick={() => setTableSearchOpen((o) => !o)}
                    className={`p-1.5 rounded transition-colors ${tableSearchOpen ? 'bg-dhl-yellow text-dhl-red' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}
                    aria-label={tableSearchOpen ? 'Hide table search' : 'Show table search'}
                    title={tableSearchOpen ? 'Hide search' : 'Search in table'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium text-dhl-red w-12">#</th>
                <SortableTh label="Name" sortKey="name" />
                <SortableTh label="Version" sortKey="version" />
                <SortableTh label="Status" sortKey="status" />
                <SortableTh label="Lifecycle" sortKey="lifecycle_status" />
                <SortableTh label="Owner" sortKey="owner_id" />
                <th className="text-left px-4 py-3 font-medium w-24">Action</th>
              </tr>
              {tableSearchOpen && (
                <tr className="bg-dhl-yellow/15 border-b border-dhl-red/30">
                  <th className="px-4 py-2" />
                  <th className="px-4 py-2" />
                  <th className="px-4 py-2">
                    <input
                      type="text"
                      value={columnFilters.name}
                      onChange={(e) => setColumnFilter('name', e.target.value)}
                      placeholder="Search…"
                      className="w-full rounded border border-dhl-red/40 px-2 py-1.5 text-sm focus:ring-2 focus:ring-dhl-red focus:border-dhl-red"
                      aria-label="Filter by Name"
                    />
                  </th>
                  <th className="px-4 py-2">
                    <input
                      type="text"
                      value={columnFilters.version}
                      onChange={(e) => setColumnFilter('version', e.target.value)}
                      placeholder="Search…"
                      className="w-full rounded border border-dhl-red/40 px-2 py-1.5 text-sm focus:ring-2 focus:ring-dhl-red focus:border-dhl-red"
                      aria-label="Filter by Version"
                    />
                  </th>
                  <th className="px-4 py-2">
                    <input
                      type="text"
                      value={columnFilters.status}
                      onChange={(e) => setColumnFilter('status', e.target.value)}
                      placeholder="Search…"
                      className="w-full rounded border border-dhl-red/40 px-2 py-1.5 text-sm focus:ring-2 focus:ring-dhl-red focus:border-dhl-red"
                      aria-label="Filter by Status"
                    />
                  </th>
                  <th className="px-4 py-2">
                    <input
                      type="text"
                      value={columnFilters.lifecycle}
                      onChange={(e) => setColumnFilter('lifecycle', e.target.value)}
                      placeholder="Search…"
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                      aria-label="Filter by Lifecycle"
                    />
                  </th>
                  <th className="px-4 py-2">
                    <input
                      type="text"
                      value={columnFilters.owner}
                      onChange={(e) => setColumnFilter('owner', e.target.value)}
                      placeholder="Search…"
                      className="w-full rounded border border-dhl-red/40 px-2 py-1.5 text-sm focus:ring-2 focus:ring-dhl-red focus:border-dhl-red"
                      aria-label="Filter by Owner"
                    />
                  </th>
                  <th className="px-4 py-2" />
                </tr>
              )}
            </thead>
            {pendingProducts.length > 0 && (
              <tbody className="bg-amber-50/30">
                <tr>
                  <td colSpan={8} className="px-4 py-2 text-sm font-semibold text-amber-800 border-b border-amber-200">
                    Pending ({pendingProducts.length})
                  </td>
                </tr>
                {pendingProducts.map((p, pendingIndex) => {
                const pendingDel = isAdmin ? pendingDeletionByProductId.get(p.id) : null;
                const pending = pendingEditsByProductId[p.id];
                const statusDisplay = pending?.status ?? p.status;
                const lifecycleDisplay = pending?.lifecycle_status ?? p.lifecycle_status;
                const ownerDisplay = pending?.owner_id !== undefined ? (pending.owner_id ?? 'none') : (p.owner_id ?? 'none');
                const isEditingThisRow = editingProductId === p.id;
                const canEditProduct = !!(user?.id && p.owner_id === user.id);
                const showEditActions = canEditProduct && (selectedProductId === p.id || isEditingThisRow);
                const serial = pendingIndex + 1;
                const showRed = dependencyInfo.isDependent.has(p.id);
                const showBlue = dependencyInfo.hasDependency.has(p.id);
                const depSerials = dependencyInfo.relatedSerialsByProductId.get(p.id) ?? [];
                const isDependentRow = showRed;
                return (
                  <tr
                    key={p.id}
                    className={`group/row border-b last:border-0 ${canEditProduct ? 'cursor-pointer hover:bg-dhl-yellow/10' : 'hover:bg-slate-50/50'} ${getRowBg(serial)} ${highlightedSerials?.has(serial) ? 'ring-2 ring-amber-400 ring-inset bg-amber-50/70' : ''} ${selectedProductId === p.id ? 'bg-dhl-yellow/15' : ''}`}
                    onMouseLeave={() => handleRowLeave(p)}
                    onClick={() => canEditProduct && !isEditingThisRow && setSelectedProductId((prev) => (prev === p.id ? null : p.id))}
                  >
                    <td className="px-4 py-3 w-10" />
                    <td className="px-4 py-3 text-gray-500 tabular-nums w-12">{serial}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1.5 ${isDependentRow ? 'font-bold italic text-red-600' : ''}`}>
                        {pendingDel && (
                          isAdmin ? (
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); openConfirmDeletion(p.id, pendingDel.id, p.name); }}
                              className="text-amber-600 hover:text-amber-800 shrink-0 p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                              title="Confirm or reject deletion request"
                              aria-label="Confirm deletion request"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                            </button>
                          ) : (
                            <span className="text-amber-600 shrink-0" title="Pending deletion request" aria-label="Pending deletion request">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                            </span>
                          )
                        )}
                        <Link href={`/products/${p.id}`} className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 rounded">
                          {p.name}
                        </Link>
                        {showRed && <span className="text-red-600 font-bold ml-0.5" aria-label="Dependent product">*</span>}
                        {showBlue && <span className="text-blue-600 font-bold ml-0.5" aria-label="Has dependency">*</span>}
                        {(showRed || showBlue) && depSerials.length > 0 && (
                          <sup
                            className="text-slate-500 font-normal ml-0.5 cursor-pointer rounded px-0.5 hover:bg-amber-100 hover:text-amber-800"
                            title="Dependency row numbers — hover or click to highlight rows"
                            role="button"
                            tabIndex={0}
                            onMouseEnter={() => { setHighlightedSerials(new Set(depSerials)); setSuperscriptPinned(false); }}
                            onMouseLeave={() => { if (!superscriptPinned) setHighlightedSerials(null); }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const same = highlightedSerials && depSerials.length === highlightedSerials.size && depSerials.every((n) => highlightedSerials.has(n));
                              if (superscriptPinned && same) {
                                setHighlightedSerials(null);
                                setSuperscriptPinned(false);
                              } else {
                                setHighlightedSerials(new Set(depSerials));
                                setSuperscriptPinned(true);
                              }
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (e.target as HTMLElement).click(); } }}
                          >
                            ({depSerials.join(', ')})
                          </sup>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">{p.version || '—'}</td>
                    <td className="px-4 py-3">
                      {canEditProduct && isEditingThisRow ? (
                        <select
                          value={normalizeProductStatus(statusDisplay)}
                          onChange={(e) => {
                            const v = e.target.value as 'pending' | 'approved' | 'archived';
                            setPendingEditsByProductId((prev) => ({
                              ...prev,
                              [p.id]: { ...prev[p.id], status: v },
                            }));
                          }}
                          className="input py-1 text-sm w-auto min-w-[100px]"
                          disabled={applyEditMutation.isPending}
                          title="Set product status (owner)"
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="archived">Archived</option>
                        </select>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-sm bg-dhl-yellow/30 text-slate-800">
                          {productStatusLabel(statusDisplay)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canEditProduct && isEditingThisRow ? (
                        <select
                          value={lifecycleDisplay}
                          onChange={(e) => {
                            const v = e.target.value;
                            setPendingEditsByProductId((prev) => ({
                              ...prev,
                              [p.id]: { ...prev[p.id], lifecycle_status: v },
                            }));
                          }}
                          className="input py-1 text-sm w-auto min-w-[120px]"
                          disabled={applyEditMutation.isPending}
                          title="Set lifecycle (owner)"
                        >
                          <option value="active">Active</option>
                          <option value="not_active">Not Active</option>
                          <option value="suspend">Suspend</option>
                          <option value="end_of_roadmap">End of roadmap</option>
                        </select>
                      ) : (
                        <span
                          className={
                            (pending?.lifecycle_status ?? p.lifecycle_status) === 'active'
                              ? 'text-green-600 text-sm'
                              : (pending?.lifecycle_status ?? p.lifecycle_status) === 'not_active'
                                ? 'text-gray-600 text-sm'
                                : (pending?.lifecycle_status ?? p.lifecycle_status) === 'suspend'
                                  ? 'text-amber-600 text-sm'
                                  : 'text-gray-600 text-sm'
                          }
                        >
                          {lifecycleDisplay === 'active'
                            ? 'Active'
                            : lifecycleDisplay === 'not_active'
                              ? 'Not Active'
                              : lifecycleDisplay === 'suspend'
                                ? 'Suspend'
                                : lifecycleDisplay === 'end_of_roadmap'
                                  ? 'End of roadmap'
                                  : lifecycleDisplay}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canEditProduct && isEditingThisRow ? (
                        <div>
                          <select
                            value={ownerDisplay}
                            onChange={(e) => {
                              const v = e.target.value;
                              setPendingEditsByProductId((prev) => ({
                                ...prev,
                                [p.id]: {
                                  ...prev[p.id],
                                  owner_id: v === 'none' ? null : v,
                                },
                              }));
                            }}
                            className="input py-1 text-sm w-auto min-w-[120px]"
                            disabled={applyEditMutation.isPending}
                            title="Set owner (owner)"
                          >
                            <option value="none">No owner</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.role})
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        p.owner?.name ?? '—'
                      )}
                    </td>
                    <td className={`px-4 py-3 align-middle transition-opacity ${(selectedProductId === p.id || isEditingThisRow) ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100'}`} onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        {showEditActions && (
                          isEditingThisRow ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleToggleEditMode(p)}
                                className="inline-flex items-center gap-1.5 min-h-[2rem] px-2 py-1 rounded-lg text-sm font-medium text-white bg-dhl-red hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-dhl-yellow cursor-pointer"
                                title="Save changes"
                                aria-label="Save"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelEdit(p.id)}
                                className="inline-flex items-center gap-1.5 min-h-[2rem] px-2 py-1 rounded-lg text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 cursor-pointer"
                                title="Cancel editing"
                                aria-label="Cancel"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingProductId(p.id)}
                              className="p-1.5 rounded text-dhl-red hover:bg-dhl-yellow/25 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-dhl-red"
                              title="Edit status, lifecycle, owner (owner only)"
                              aria-label="Edit"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                <path d="m15 5 4 4" />
                              </svg>
                            </button>
                          )
                        )}
                        {canEditProduct ? (
                          <Link
                            href={`/products/${p.id}`}
                            className="inline-flex p-1.5 rounded text-dhl-red hover:bg-dhl-yellow/25 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-dhl-red"
                            title="Edit product"
                            aria-label="Edit product"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                              <path d="m15 5 4 4" />
                            </svg>
                          </Link>
                        ) : (
                          <Link href={`/products/${p.id}`} className="text-blue-600 hover:underline text-sm">
                            View
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            )}
            <tbody>
              {pendingProducts.length > 0 && otherProducts.length > 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-2 text-sm font-semibold text-gray-700 border-b border-slate-200 bg-slate-50/50">
                    Products
                  </td>
                </tr>
              )}
              {otherProducts.map((p, otherIndex) => {
                const pendingDel = isAdmin ? pendingDeletionByProductId.get(p.id) : null;
                const pending = pendingEditsByProductId[p.id];
                const statusDisplay = pending?.status ?? p.status;
                const lifecycleDisplay = pending?.lifecycle_status ?? p.lifecycle_status;
                const ownerDisplay = pending?.owner_id !== undefined ? (pending.owner_id ?? 'none') : (p.owner_id ?? 'none');
                const isEditingThisRow = editingProductId === p.id;
                const canEditProduct = !!(user?.id && p.owner_id === user.id);
                const showEditActions = canEditProduct && (selectedProductId === p.id || isEditingThisRow);
                const serial = pendingProducts.length + otherIndex + 1;
                const showRed = dependencyInfo.isDependent.has(p.id);
                const showBlue = dependencyInfo.hasDependency.has(p.id);
                const depSerials = dependencyInfo.relatedSerialsByProductId.get(p.id) ?? [];
                const isDependentRow = showRed;
                return (
                  <tr
                    key={p.id}
                    className={`group/row border-b last:border-0 ${canEditProduct ? 'cursor-pointer hover:bg-dhl-yellow/10' : 'hover:bg-slate-50/50'} ${getRowBg(serial)} ${highlightedSerials?.has(serial) ? 'ring-2 ring-amber-400 ring-inset bg-amber-50/70' : ''} ${selectedProductId === p.id ? 'bg-dhl-yellow/15' : ''}`}
                    onMouseLeave={() => handleRowLeave(p)}
                    onClick={() => canEditProduct && !isEditingThisRow && setSelectedProductId((prev) => (prev === p.id ? null : p.id))}
                  >
                    <td className="px-4 py-3 w-10" />
                    <td className="px-4 py-3 text-gray-500 tabular-nums w-12">{serial}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1.5 ${isDependentRow ? 'font-bold italic text-red-600' : ''}`}>
                        {pendingDel && (
                          isAdmin ? (
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); openConfirmDeletion(p.id, pendingDel.id, p.name); }}
                              className="text-amber-600 hover:text-amber-800 shrink-0 p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                              title="Confirm or reject deletion request"
                              aria-label="Confirm deletion request"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                            </button>
                          ) : (
                            <span className="text-amber-600 shrink-0" title="Pending deletion request" aria-label="Pending deletion request">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                            </span>
                          )
                        )}
                        <Link href={`/products/${p.id}`} className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 rounded">
                          {p.name}
                        </Link>
                        {showRed && <span className="text-red-600 font-bold ml-0.5" aria-label="Dependent product">*</span>}
                        {showBlue && <span className="text-blue-600 font-bold ml-0.5" aria-label="Has dependency">*</span>}
                        {(showRed || showBlue) && depSerials.length > 0 && (
                          <sup
                            className="text-slate-500 font-normal ml-0.5 cursor-pointer rounded px-0.5 hover:bg-amber-100 hover:text-amber-800"
                            title="Dependency row numbers — hover or click to highlight rows"
                            role="button"
                            tabIndex={0}
                            onMouseEnter={() => { setHighlightedSerials(new Set(depSerials)); setSuperscriptPinned(false); }}
                            onMouseLeave={() => { if (!superscriptPinned) setHighlightedSerials(null); }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const same = highlightedSerials && depSerials.length === highlightedSerials.size && depSerials.every((n) => highlightedSerials.has(n));
                              if (superscriptPinned && same) {
                                setHighlightedSerials(null);
                                setSuperscriptPinned(false);
                              } else {
                                setHighlightedSerials(new Set(depSerials));
                                setSuperscriptPinned(true);
                              }
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (e.target as HTMLElement).click(); } }}
                          >
                            ({depSerials.join(', ')})
                          </sup>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">{p.version || '—'}</td>
                    <td className="px-4 py-3">
                      {canEditProduct && isEditingThisRow ? (
                        <select
                          value={normalizeProductStatus(statusDisplay)}
                          onChange={(e) => {
                            const v = e.target.value as 'pending' | 'approved' | 'archived';
                            setPendingEditsByProductId((prev) => ({
                              ...prev,
                              [p.id]: { ...prev[p.id], status: v },
                            }));
                          }}
                          className="input py-1 text-sm w-auto min-w-[100px]"
                          disabled={applyEditMutation.isPending}
                          title="Set product status (owner)"
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="archived">Archived</option>
                        </select>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-sm bg-dhl-yellow/30 text-slate-800">
                          {productStatusLabel(statusDisplay)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canEditProduct && isEditingThisRow ? (
                        <select
                          value={lifecycleDisplay}
                          onChange={(e) => {
                            const v = e.target.value;
                            setPendingEditsByProductId((prev) => ({
                              ...prev,
                              [p.id]: { ...prev[p.id], lifecycle_status: v },
                            }));
                          }}
                          className="input py-1 text-sm w-auto min-w-[120px]"
                          disabled={applyEditMutation.isPending}
                          title="Set lifecycle (owner)"
                        >
                          <option value="active">Active</option>
                          <option value="not_active">Not Active</option>
                          <option value="suspend">Suspend</option>
                          <option value="end_of_roadmap">End of roadmap</option>
                        </select>
                      ) : (
                        <span
                          className={
                            (pending?.lifecycle_status ?? p.lifecycle_status) === 'active'
                              ? 'text-green-600 text-sm'
                              : (pending?.lifecycle_status ?? p.lifecycle_status) === 'not_active'
                                ? 'text-gray-600 text-sm'
                                : (pending?.lifecycle_status ?? p.lifecycle_status) === 'suspend'
                                  ? 'text-amber-600 text-sm'
                                  : 'text-gray-600 text-sm'
                          }
                        >
                          {lifecycleDisplay === 'active'
                            ? 'Active'
                            : lifecycleDisplay === 'not_active'
                              ? 'Not Active'
                              : lifecycleDisplay === 'suspend'
                                ? 'Suspend'
                                : lifecycleDisplay === 'end_of_roadmap'
                                  ? 'End of roadmap'
                                  : lifecycleDisplay}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canEditProduct && isEditingThisRow ? (
                        <div>
                          <select
                            value={ownerDisplay}
                            onChange={(e) => {
                              const v = e.target.value;
                              setPendingEditsByProductId((prev) => ({
                                ...prev,
                                [p.id]: {
                                  ...prev[p.id],
                                  owner_id: v === 'none' ? null : v,
                                },
                              }));
                            }}
                            className="input py-1 text-sm w-auto min-w-[120px]"
                            disabled={applyEditMutation.isPending}
                            title="Set owner (owner)"
                          >
                            <option value="none">No owner</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.role})
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        p.owner?.name ?? '—'
                      )}
                    </td>
                    <td className={`px-4 py-3 align-middle transition-opacity ${(selectedProductId === p.id || isEditingThisRow) ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100'}`} onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        {showEditActions && (
                          isEditingThisRow ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleToggleEditMode(p)}
                                className="inline-flex items-center gap-1.5 min-h-[2rem] px-2 py-1 rounded-lg text-sm font-medium text-white bg-dhl-red hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-dhl-yellow cursor-pointer"
                                title="Save changes"
                                aria-label="Save"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelEdit(p.id)}
                                className="inline-flex items-center gap-1.5 min-h-[2rem] px-2 py-1 rounded-lg text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 cursor-pointer"
                                title="Cancel editing"
                                aria-label="Cancel"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingProductId(p.id)}
                              className="p-1.5 rounded text-dhl-red hover:bg-dhl-yellow/25 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-dhl-red"
                              title="Edit status, lifecycle, owner (owner only)"
                              aria-label="Edit"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                <path d="m15 5 4 4" />
                              </svg>
                            </button>
                          )
                        )}
                        {canEditProduct ? (
                          <Link
                            href={`/products/${p.id}`}
                            className="inline-flex p-1.5 rounded text-dhl-red hover:bg-dhl-yellow/25 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-dhl-red"
                            title="Edit product"
                            aria-label="Edit product"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                              <path d="m15 5 4 4" />
                            </svg>
                          </Link>
                        ) : (
                          <Link href={`/products/${p.id}`} className="text-blue-600 hover:underline text-sm">
                            View
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {result && (
            <div className="flex flex-wrap justify-between items-center gap-3 px-4 py-3 border-t bg-gray-50">
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-sm text-gray-600">
                  {result.total === 0
                    ? 'No products'
                    : `${result.offset + 1}–${Math.min(result.offset + result.items.length, result.total)} of ${result.total}`}
                </span>
                <div className="flex items-center gap-2">
                  <label htmlFor="products-page-size" className="text-sm text-gray-600 whitespace-nowrap">
                    Rows per page:
                  </label>
                  <select
                    id="products-page-size"
                    value={String(pageSizeSelectValue)}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === 'custom') {
                        setPageSize(effectiveLimit in PAGE_SIZE_OPTIONS ? PAGE_SIZE_DEFAULT : effectiveLimit);
                        setCustomPageSizeInput(String(effectiveLimit));
                      } else {
                        const n = Number(v);
                        setPageSize(n);
                        setCustomPageSizeInput('');
                        setOffset(0);
                      }
                    }}
                    className="rounded border border-slate-200 px-2 py-1.5 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                    aria-label="Rows per page"
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                    <option value="custom">Custom</option>
                  </select>
                  {pageSizeSelectValue === 'custom' && (
                    <input
                      type="number"
                      min={1}
                      max={PAGE_SIZE_MAX}
                      value={customPageSizeInput}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setCustomPageSizeInput(raw);
                        const n = parseInt(raw, 10);
                        if (!Number.isNaN(n)) {
                          const clamped = Math.min(PAGE_SIZE_MAX, Math.max(1, n));
                          setPageSize(clamped);
                          setOffset(0);
                        }
                      }}
                      onBlur={() => {
                        if (customPageSizeInput === '' || Number.isNaN(parseInt(customPageSizeInput, 10))) {
                          setCustomPageSizeInput(String(effectiveLimit));
                        } else {
                          const n = Math.min(PAGE_SIZE_MAX, Math.max(1, parseInt(customPageSizeInput, 10)));
                          setCustomPageSizeInput(String(n));
                          setPageSize(n);
                        }
                      }}
                      className="w-16 rounded border border-slate-200 px-2 py-1.5 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                      placeholder={`1–${PAGE_SIZE_MAX}`}
                      aria-label="Custom rows per page (max 200)"
                    />
                  )}
                </div>
              </div>
              {result.total > effectiveLimit && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={result.offset === 0}
                    onClick={() => setOffset((o) => Math.max(0, o - effectiveLimit))}
                    className="btn-secondary text-sm disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={result.offset + result.items.length >= result.total}
                    onClick={() => setOffset((o) => o + effectiveLimit)}
                    className="btn-secondary text-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Double confirmation modal: product name + version (when leaving row with pending edits) */}
      {isAdmin && confirmEditProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-edit-title">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 id="confirm-edit-title" className="text-lg font-semibold text-gray-900 mb-2">
              Confirm changes
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              To apply your changes, type the <strong>product name</strong> and <strong>version</strong> exactly as shown below. This action is logged in the audit log.
            </p>
            <p className="text-sm text-gray-500 mb-3 bg-gray-50 px-3 py-2 rounded border border-gray-200">
              Product: <strong>{confirmEditProduct.product.name || '—'}</strong>
              {confirmEditProduct.product.version != null && confirmEditProduct.product.version !== '' && (
                <> · Version: <strong>{confirmEditProduct.product.version}</strong></>
              )}
              {(confirmEditProduct.product.version == null || confirmEditProduct.product.version === '') && (
                <> · Version: <strong>(leave empty if none)</strong></>
              )}
            </p>
            <label className="block text-gray-700 text-sm font-medium mb-1">
              Product name
            </label>
            <input
              type="text"
              value={confirmProductNameTyped}
              onChange={(e) => setConfirmProductNameTyped(e.target.value)}
              className="input mb-4"
              placeholder={confirmEditProduct.product.name ? `e.g. ${confirmEditProduct.product.name}` : 'Type the product name'}
              aria-label="Product name"
              autoComplete="off"
            />
            <label className="block text-gray-700 text-sm font-medium mb-1">
              Version
            </label>
            <input
              type="text"
              value={confirmVersionTyped}
              onChange={(e) => setConfirmVersionTyped(e.target.value)}
              className="input mb-4"
              placeholder={confirmEditProduct.product.version ? `e.g. ${confirmEditProduct.product.version}` : 'Leave empty if no version'}
              aria-label="Version"
              autoComplete="off"
            />
            {applyEditMutation.isError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200" role="alert">
                <p className="text-red-700 text-sm font-medium">
                  {applyEditMutation.error?.message ?? 'Update failed'}
                </p>
                {(applyEditMutation.error?.message === 'Bad Request' || !applyEditMutation.error?.message) && (
                  <p className="text-red-600 text-xs mt-2">
                    Common causes: set Lifecycle to <strong>Active</strong> only if the product has a &quot;Pricing Committee Approval&quot; milestone; use a valid user as Owner.
                  </p>
                )}
                <p className="text-red-600 text-xs mt-1">
                  Fix the issue above or cancel. The modal stays open so you can correct and try again.
                </p>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={closeEditConfirmModal} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmEditApply}
                disabled={!isEditConfirmValid || applyEditMutation.isPending}
                className="btn-primary disabled:opacity-50"
              >
                {applyEditMutation.isPending ? 'Applying…' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Double confirmation modal for Confirm Deletion */}
      {isAdmin && confirmDeletionProductId && confirmDeletionRequestId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-deletion-title">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 id="confirm-deletion-title" className="text-lg font-semibold text-gray-900 mb-2">
              Confirm deletion request
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              This will <strong>archive</strong> the product (status set to Archived). The product and its data will remain but will be marked as archived. This action requires double confirmation.
            </p>
            <p className="text-gray-600 text-sm mb-2">
              Type the exact <strong>product name</strong> below to confirm:
            </p>
            <p className="text-sm text-gray-500 mb-3 bg-gray-50 px-3 py-2 rounded border border-gray-200">
              Product: <strong>{confirmDeletionProductName || '—'}</strong>
            </p>
            <input
              type="text"
              value={confirmDeletionTyped}
              onChange={(e) => setConfirmDeletionTyped(e.target.value)}
              className="input mb-4"
              placeholder={confirmDeletionProductName ? `e.g. ${confirmDeletionProductName}` : 'Type the product name'}
              aria-label="Product name"
              autoComplete="off"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={closeConfirmDeletion}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmArchive}
                disabled={confirmDeletionTyped.trim() !== (confirmDeletionProductName || '').trim() || approveDeletionMutation.isPending}
                className="btn-primary bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
              >
                {approveDeletionMutation.isPending ? 'Archiving…' : 'Confirm and archive'}
              </button>
            </div>
            {approveDeletionMutation.isError && (
              <p className="text-red-600 text-sm mt-2" role="alert">
                {approveDeletionMutation.error?.message}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <RequireAuth>
      <ProductsContent />
    </RequireAuth>
  );
}
