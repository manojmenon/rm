'use client';

import { useState, Fragment } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import {
  type DateRangePresetOrAll,
  type DateRangeFilters,
  DATE_RANGE_PRESET_OPTIONS_WITH_ALL,
  getDateRangeForPreset,
  getDefaultDateRange,
} from '@/lib/dateRangePresets';

/** Audit logs default: show all time so previous entries are visible. */
const DEFAULT_AUDIT_DATE_PRESET: DateRangePresetOrAll = 'all';

const PAGE_SIZE = 30;

function IconPlus({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors ${className ?? ''}`} style={{ width: 28, height: 28 }}>
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </span>
  );
}

function IconMinus({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors ${className ?? ''}`} style={{ width: 28, height: 28 }}>
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12h14" />
      </svg>
    </span>
  );
}

function getChangedKeys(
  oldData: Record<string, unknown> | null | undefined,
  newData: Record<string, unknown> | null | undefined
): Set<string> {
  const keys = new Set<string>();
  const o = oldData ?? {};
  const n = newData ?? {};
  const allKeys = new Set([...Object.keys(o), ...Object.keys(n)]);
  allKeys.forEach((key) => {
    const ov = o[key];
    const nv = n[key];
    const oStr = JSON.stringify(ov);
    const nStr = JSON.stringify(nv);
    if (oStr !== nStr) keys.add(key);
  });
  return keys;
}

function renderDataBlock(
  data: Record<string, unknown> | null | undefined,
  changedKeys: Set<string>
) {
  const obj = data ?? {};
  const entries = Object.entries(obj);
  if (entries.length === 0) return <span className="text-gray-400">—</span>;
  return (
    <pre className="mt-1 p-2 bg-white rounded text-xs overflow-x-auto whitespace-pre-wrap break-all">
      {entries.map(([key, value]) => {
        const isChanged = changedKeys.has(key);
        const display = typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : String(value ?? '');
        return (
          <div key={key} className="mb-0.5">
            <span className="text-gray-600">{key}: </span>
            {isChanged ? (
              <span className="text-red-600 font-bold">{display}</span>
            ) : (
              <span>{display}</span>
            )}
          </div>
        );
      })}
    </pre>
  );
}

type ColumnFilters = {
  time: string;
  user: string;
  action: string;
  entity: string;
  entityId: string;
  ip: string;
  trace: string;
};

const defaultColumnFilters: ColumnFilters = {
  time: '',
  user: '',
  action: '',
  entity: '',
  entityId: '',
  ip: '',
  trace: '',
};

function matchesColumn(
  log: { timestamp: string; user?: { name: string }; user_id?: string; action: string; entity_type: string; entity_id: string; ip_address: string; trace_id: string },
  filters: ColumnFilters,
  dateRange: DateRangeFilters
): boolean {
  const logTime = new Date(log.timestamp).getTime();
  if (dateRange.dateFrom) {
    const from = new Date(dateRange.dateFrom);
    from.setHours(0, 0, 0, 0);
    if (logTime < from.getTime()) return false;
  }
  if (dateRange.dateTo) {
    const to = new Date(dateRange.dateTo);
    to.setHours(23, 59, 59, 999);
    if (logTime > to.getTime()) return false;
  }
  const timeStr = new Date(log.timestamp).toLocaleString();
  const userStr = (log.user?.name ?? log.user_id ?? '') || '—';
  const entityIdStr = log.entity_id || '—';
  if (filters.time && !timeStr.toLowerCase().includes(filters.time.toLowerCase())) return false;
  if (filters.user && !userStr.toLowerCase().includes(filters.user.toLowerCase())) return false;
  if (filters.action && !log.action.toLowerCase().includes(filters.action.toLowerCase())) return false;
  if (filters.entity && !log.entity_type.toLowerCase().includes(filters.entity.toLowerCase())) return false;
  if (filters.entityId && !entityIdStr.toLowerCase().includes(filters.entityId.toLowerCase())) return false;
  if (filters.ip && !(log.ip_address ?? '').toLowerCase().includes(filters.ip.toLowerCase())) return false;
  if (filters.trace && !(log.trace_id ?? '').toLowerCase().includes(filters.trace.toLowerCase())) return false;
  return true;
}

export function AuditLogsContent() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = (() => { const r = user?.role?.toLowerCase(); return r === 'admin' || r === 'superadmin'; })();
  const isAuditOnlyPage = pathname === '/audit-logs';
  const [viewMode, setViewMode] = useState<'main' | 'archive'>('main');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [offset, setOffset] = useState(0);
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>(defaultColumnFilters);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());

  const toggleRawData = (logId: string) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) next.delete(logId);
      else next.add(logId);
      return next;
    });
  };

  const [dateRangePreset, setDateRangePreset] = useState<DateRangePresetOrAll>(DEFAULT_AUDIT_DATE_PRESET);
  const [dateRange, setDateRange] = useState<DateRangeFilters>(getDateRangeForPreset('all'));
  const [sortBy, setSortBy] = useState<string>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const setDateRangePresetAndRange = (preset: DateRangePresetOrAll, range?: DateRangeFilters) => {
    setDateRangePreset(preset);
    setDateRange(range ?? getDateRangeForPreset(preset));
  };

  const clearAllFilters = () => {
    setEntityType('');
    setAction('');
    setColumnFilters(defaultColumnFilters);
    setDateRangePreset(DEFAULT_AUDIT_DATE_PRESET);
    setDateRange(getDateRangeForPreset('all'));
    setOffset(0);
  };

  const hasActiveFilters = Boolean(
    entityType ||
    action ||
    (dateRangePreset !== 'all' && (dateRange.dateFrom || dateRange.dateTo)) ||
    Object.values(columnFilters).some((v) => v.trim() !== '')
  );

  const setColumnFilter = (key: keyof ColumnFilters, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSort = (sortKey: string) => {
    setSortBy(sortKey);
    setSortOrder((o) => (sortBy === sortKey ? (o === 'asc' ? 'desc' : 'asc') : 'desc'));
    setOffset(0);
  };
  const SortableTh = ({ label, sortKey }: { label: string; sortKey: string }) => (
    <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">
      <button
        type="button"
        onClick={() => handleSort(sortKey)}
        className="flex items-center gap-1 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 rounded"
      >
        {label}
        {sortBy === sortKey && (
          <span className="text-xs" aria-hidden>{sortOrder === 'asc' ? '↑' : '↓'}</span>
        )}
      </button>
    </th>
  );

  const { data: result, isLoading } = useQuery({
    queryKey: [
      'audit-logs',
      {
        limit: PAGE_SIZE,
        offset,
        archived: viewMode === 'archive',
        entity_type: entityType || undefined,
        action: action || undefined,
        date_from: dateRangePreset !== 'all' && dateRange.dateFrom ? dateRange.dateFrom : undefined,
        date_to: dateRangePreset !== 'all' && dateRange.dateTo ? dateRange.dateTo : undefined,
        sort_by: sortBy,
        order: sortOrder,
      },
    ],
    queryFn: () =>
      api.auditLogs.list({
        limit: PAGE_SIZE,
        offset,
        archived: viewMode === 'archive',
        ...(entityType && { entity_type: entityType }),
        ...(action && { action }),
        ...(dateRangePreset !== 'all' &&
          dateRange.dateFrom &&
          dateRange.dateTo && {
            date_from: dateRange.dateFrom,
            date_to: dateRange.dateTo,
          }),
        sort_by: sortBy,
        order: sortOrder,
      }),
  });

  const archiveMutation = useMutation({
    mutationFn: (ids: string[]) => api.auditLogs.archive(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      setSelectedIds(new Set());
    },
  });

  const [showDeleteArchivedModal, setShowDeleteArchivedModal] = useState(false);
  const [deleteArchivedPassword, setDeleteArchivedPassword] = useState('');
  const deleteArchivedMutation = useMutation({
    mutationFn: ({ ids, password }: { ids: string[]; password: string }) =>
      api.auditLogs.deleteArchived(ids, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      setSelectedIds(new Set());
      setShowDeleteArchivedModal(false);
      setDeleteArchivedPassword('');
    },
  });

  const allLogIdsOnPage = (result?.items ?? []).map((log) => log.id);
  const allSelectedOnPage = allLogIdsOnPage.length > 0 && allLogIdsOnPage.every((id) => selectedIds.has(id));
  const toggleSelectAll = () => {
    if (allSelectedOnPage) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allLogIdsOnPage.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allLogIdsOnPage.forEach((id) => next.add(id));
        return next;
      });
    }
  };
  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allLogs = result?.items ?? [];
  const logs = allLogs.filter((log) => matchesColumn(log, columnFilters, dateRange));
  const total = result?.total ?? 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Audit logs</h1>
        <Link href={isAuditOnlyPage ? '/dashboard' : '/admin'} className="btn-secondary">
          {isAuditOnlyPage ? 'Back to Dashboard' : 'Back to Admin'}
        </Link>
      </div>
      <p className="text-gray-600 mb-4">
        {isAuditOnlyPage
          ? 'View who changed what and when for products you own. Product, milestone, and version changes are shown.'
          : 'View who changed what and when. Only product create/update/delete are currently audited.'}
      </p>

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => { setViewMode('main'); setOffset(0); setSelectedIds(new Set()); }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${viewMode === 'main' ? 'bg-dhl-yellow text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Main logs
          </button>
          <button
            type="button"
            onClick={() => { setViewMode('archive'); setOffset(0); setSelectedIds(new Set()); }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${viewMode === 'archive' ? 'bg-dhl-yellow text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Archive
          </button>
        </div>
        {isAdmin && viewMode === 'main' && selectedIds.size > 0 && (
          <>
            <button
              type="button"
              onClick={() => archiveMutation.mutate(Array.from(selectedIds))}
              disabled={archiveMutation.isPending}
              className="btn-primary text-sm"
            >
              {archiveMutation.isPending ? 'Archiving…' : `Archive ${selectedIds.size} selected`}
            </button>
            {archiveMutation.isError && (
              <span className="text-red-600 text-sm" role="alert">
                {archiveMutation.error?.message}
              </span>
            )}
          </>
        )}
        {isAdmin && viewMode === 'archive' && selectedIds.size > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowDeleteArchivedModal(true)}
              disabled={deleteArchivedMutation.isPending}
              className="btn-secondary text-sm text-red-600 hover:bg-red-50 border-red-200"
            >
              Delete {selectedIds.size} selected
            </button>
          </>
        )}
      </div>

      {isAdmin && showDeleteArchivedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-archived-title">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 id="delete-archived-title" className="text-lg font-semibold text-gray-900 mb-2">
              Delete archived logs
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              Permanently delete {selectedIds.size} selected log(s) from the archive? Enter your password to confirm.
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={deleteArchivedPassword}
              onChange={(e) => setDeleteArchivedPassword(e.target.value)}
              className="input mb-4"
              placeholder="Your password"
              autoComplete="current-password"
              aria-label="Confirm password"
            />
            {deleteArchivedMutation.isError && (
              <p className="text-red-600 text-sm mb-4" role="alert">
                {deleteArchivedMutation.error?.message}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setShowDeleteArchivedModal(false); setDeleteArchivedPassword(''); deleteArchivedMutation.reset(); }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteArchivedMutation.mutate({ ids: Array.from(selectedIds), password: deleteArchivedPassword })}
                disabled={!deleteArchivedPassword.trim() || deleteArchivedMutation.isPending}
                className="btn-primary bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {deleteArchivedMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  if (preset !== 'custom') setOffset(0);
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
                    onChange={(e) => setDateRange((prev) => ({ ...prev, dateFrom: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                    aria-label="Date from"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Date to</label>
                  <input
                    type="date"
                    value={dateRange.dateTo}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, dateTo: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                    aria-label="Date to"
                  />
                </div>
              </>
            )}
            {dateRangePreset !== 'custom' && dateRangePreset !== 'all' && dateRange.dateFrom && dateRange.dateTo && (
              <div className="flex flex-col gap-1.5 text-sm text-slate-600 col-span-2 sm:col-span-1">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Range</span>
                <span>{dateRange.dateFrom} – {dateRange.dateTo}</span>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">User</label>
              <input
                type="text"
                value={columnFilters.user}
                onChange={(e) => setColumnFilter('user', e.target.value)}
                placeholder="Search user…"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                aria-label="Filter by User"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Action</label>
              <select
                value={action}
                onChange={(e) => { setAction(e.target.value); setOffset(0); }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400 w-full"
              >
                <option value="">All</option>
                <option value="create">create</option>
                <option value="update">update</option>
                <option value="delete">delete</option>
                <option value="approve">approve</option>
                <option value="reject">reject</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Entity</label>
              <select
                value={entityType}
                onChange={(e) => { setEntityType(e.target.value); setOffset(0); }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400 w-full"
              >
                <option value="">All</option>
                <option value="product">product</option>
                <option value="milestone">milestone</option>
                <option value="product_version">product_version</option>
                <option value="dependency">dependency</option>
                <option value="product_request">product_request</option>
                <option value="product_deletion_request">product_deletion_request</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Entity ID</label>
              <input
                type="text"
                value={columnFilters.entityId}
                onChange={(e) => setColumnFilter('entityId', e.target.value)}
                placeholder="Search entity ID…"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                aria-label="Filter by Entity ID"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">IP</label>
              <input
                type="text"
                value={columnFilters.ip}
                onChange={(e) => setColumnFilter('ip', e.target.value)}
                placeholder="Search IP…"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                aria-label="Filter by IP"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Trace</label>
              <input
                type="text"
                value={columnFilters.trace}
                onChange={(e) => setColumnFilter('trace', e.target.value)}
                placeholder="Search trace ID…"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                aria-label="Filter by Trace"
              />
            </div>
          </div>
          {hasActiveFilters && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <button type="button" onClick={clearAllFilters} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 bg-slate-200/80 hover:bg-slate-300 transition-colors">
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </details>

      {isLoading ? (
        <p className="text-gray-500">Loading audit logs...</p>
      ) : allLogs.length === 0 ? (
        <p className="text-gray-500">No audit logs match the filters.</p>
      ) : logs.length === 0 ? (
        <p className="text-gray-500">No rows on this page match the column search. Clear column filters or change page.</p>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {isAdmin && (viewMode === 'main' || viewMode === 'archive') && (
                    <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm w-10">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allLogIdsOnPage.length > 0 && allSelectedOnPage}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300 text-dhl-red focus:ring-dhl-red"
                          aria-label="Select all on page"
                        />
                        <span className="text-xs">Select all</span>
                      </label>
                    </th>
                  )}
                  <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm w-12">#</th>
                  <SortableTh label="Time" sortKey="timestamp" />
                  <SortableTh label="User" sortKey="user_id" />
                  <SortableTh label="Action" sortKey="action" />
                  <SortableTh label="Entity" sortKey="entity_type" />
                  <SortableTh label="Entity ID" sortKey="entity_id" />
                  <SortableTh label="IP" sortKey="ip_address" />
                  <SortableTh label="Trace" sortKey="trace_id" />
                  <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm w-16">Raw</th>
                </tr>
                <tr className="bg-gray-100/80 border-b">
                  {isAdmin && (viewMode === 'main' || viewMode === 'archive') && <th className="py-1.5 px-4 w-10" />}
                  <th className="py-1.5 px-4 w-12" />
                  <th className="py-1.5 px-4">
                    <input
                      type="text"
                      value={columnFilters.time}
                      onChange={(e) => setColumnFilter('time', e.target.value)}
                      placeholder="Search…"
                      className="rounded border border-gray-200 py-1 px-2 text-xs w-full max-w-[140px] focus:ring-2 focus:ring-slate-400"
                      aria-label="Search Time"
                    />
                  </th>
                  <th className="py-1.5 px-4">
                    <input
                      type="text"
                      value={columnFilters.user}
                      onChange={(e) => setColumnFilter('user', e.target.value)}
                      placeholder="Search…"
                      className="rounded border border-gray-200 py-1 px-2 text-xs w-full max-w-[120px] focus:ring-2 focus:ring-slate-400"
                      aria-label="Search User"
                    />
                  </th>
                  <th className="py-1.5 px-4">
                    <input
                      type="text"
                      value={columnFilters.action}
                      onChange={(e) => setColumnFilter('action', e.target.value)}
                      placeholder="Search…"
                      className="rounded border border-gray-200 py-1 px-2 text-xs w-full max-w-[80px] focus:ring-2 focus:ring-slate-400"
                      aria-label="Search Action"
                    />
                  </th>
                  <th className="py-1.5 px-4">
                    <input
                      type="text"
                      value={columnFilters.entity}
                      onChange={(e) => setColumnFilter('entity', e.target.value)}
                      placeholder="Search…"
                      className="rounded border border-gray-200 py-1 px-2 text-xs w-full max-w-[100px] focus:ring-2 focus:ring-slate-400"
                      aria-label="Search Entity"
                    />
                  </th>
                  <th className="py-1.5 px-4">
                    <input
                      type="text"
                      value={columnFilters.entityId}
                      onChange={(e) => setColumnFilter('entityId', e.target.value)}
                      placeholder="Search…"
                      className="rounded border border-gray-200 py-1 px-2 text-xs w-full max-w-[120px] focus:ring-2 focus:ring-slate-400"
                      aria-label="Search Entity ID"
                    />
                  </th>
                  <th className="py-1.5 px-4">
                    <input
                      type="text"
                      value={columnFilters.ip}
                      onChange={(e) => setColumnFilter('ip', e.target.value)}
                      placeholder="Search…"
                      className="rounded border border-gray-200 py-1 px-2 text-xs w-full max-w-[100px] focus:ring-2 focus:ring-slate-400"
                      aria-label="Search IP"
                    />
                  </th>
                  <th className="py-1.5 px-4">
                    <input
                      type="text"
                      value={columnFilters.trace}
                      onChange={(e) => setColumnFilter('trace', e.target.value)}
                      placeholder="Search…"
                      className="rounded border border-gray-200 py-1 px-2 text-xs w-full max-w-[120px] focus:ring-2 focus:ring-slate-400"
                      aria-label="Search Trace"
                    />
                  </th>
                  <th className="py-1.5 px-4 w-16" />
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => {
                  const displayNum = offset + index + 1;
                  const isExpanded = expandedLogIds.has(log.id);
                  const hasRawData = (log.old_data && Object.keys(log.old_data).length > 0) || (log.new_data && Object.keys(log.new_data).length > 0);
                  const changedKeys = getChangedKeys(log.old_data ?? undefined, log.new_data ?? undefined);
                  return (
                    <Fragment key={log.id}>
                      <tr className="border-b border-gray-200 hover:bg-gray-50/50">
                        {isAdmin && (viewMode === 'main' || viewMode === 'archive') && (
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(log.id)}
                              onChange={() => toggleSelectOne(log.id)}
                              className="rounded border-gray-300 text-dhl-red focus:ring-dhl-red"
                              aria-label={`Select log ${displayNum}`}
                            />
                          </td>
                        )}
                        <td className="py-3 px-4 text-sm text-gray-500 tabular-nums">
                          {displayNum}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {log.user?.name ?? log.user_id ?? '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={
                              log.action === 'create'
                                ? 'text-green-600 text-sm font-medium'
                                : log.action === 'delete'
                                  ? 'text-red-600 text-sm font-medium'
                                  : 'text-blue-600 text-sm font-medium'
                            }
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">{log.entity_type}</td>
                        <td className="py-3 px-4 text-sm">
                          {log.entity_type === 'product' && log.entity_id ? (
                            <Link
                              href={`/products/${log.entity_id}`}
                              className="text-blue-600 hover:underline"
                            >
                              {log.entity_id}
                            </Link>
                          ) : (
                            log.entity_id || '—'
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-500 max-w-[120px] truncate" title={log.ip_address || undefined}>
                          {log.ip_address || '—'}
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-500 max-w-[140px] truncate" title={log.trace_id || undefined}>
                          {log.trace_id || '—'}
                        </td>
                        <td className="py-3 px-4">
                          {hasRawData ? (
                            <button
                              type="button"
                              onClick={() => toggleRawData(log.id)}
                              className="inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 rounded"
                              title={isExpanded ? 'Hide raw data' : 'Show raw data'}
                              aria-label={isExpanded ? 'Hide raw data' : 'Show raw data'}
                            >
                              {isExpanded ? <IconMinus /> : <IconPlus />}
                            </button>
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && hasRawData && (
                        <tr key={`${log.id}-raw`} className="bg-gray-50 border-b border-gray-200">
                          <td colSpan={isAdmin && (viewMode === 'main' || viewMode === 'archive') ? 10 : 9} className="py-3 px-4 align-top">
                            <div className="grid gap-4 md:grid-cols-2 text-sm">
                              {log.old_data && Object.keys(log.old_data).length > 0 && (
                                <div>
                                  <span className="text-gray-500 font-medium">Old:</span>
                                  {renderDataBlock(log.old_data, changedKeys)}
                                </div>
                              )}
                              {log.new_data && Object.keys(log.new_data).length > 0 && (
                                <div>
                                  <span className="text-gray-500 font-medium">New:</span>
                                  {renderDataBlock(log.new_data, changedKeys)}
                                </div>
                              )}
                              {(!log.old_data || Object.keys(log.old_data).length === 0) && (!log.new_data || Object.keys(log.new_data).length === 0) && (
                                <p className="text-gray-500">No old/new payload</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {result && total > PAGE_SIZE && (
            <div className="flex justify-between items-center px-4 py-3 border-t bg-gray-50">
              <span className="text-sm text-gray-600">
                {result.offset + 1}–{Math.min(result.offset + result.items.length, result.total)} of {result.total}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={offset === 0}
                  onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                  className="btn-secondary text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={offset + logs.length >= total}
                  onClick={() => setOffset((o) => o + PAGE_SIZE)}
                  className="btn-secondary text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
