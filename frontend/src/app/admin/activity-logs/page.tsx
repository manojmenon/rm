'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { RequireAuth } from '@/components/RequireAuth';
import { RequireRole } from '@/components/RequireRole';
import { api } from '@/lib/api';
import {
  type DateRangePresetOrAll,
  type DateRangeFilters,
  DATE_RANGE_PRESET_OPTIONS_WITH_ALL,
  getDateRangeForPreset,
} from '@/lib/dateRangePresets';

const PAGE_SIZE = 30;
const DEFAULT_DATE_PRESET: DateRangePresetOrAll = 'all';

export function ActivityLogsContent() {
  const pathname = usePathname();
  const isActivityOnlyPage = pathname === '/activity-logs';
  const [offset, setOffset] = useState(0);
  const [action, setAction] = useState('');
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePresetOrAll>(DEFAULT_DATE_PRESET);
  const [dateRange, setDateRange] = useState<DateRangeFilters>(getDateRangeForPreset('all'));
  const [sortBy, setSortBy] = useState<string>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const setDateRangePresetAndRange = (preset: DateRangePresetOrAll, range?: DateRangeFilters) => {
    setDateRangePreset(preset);
    setDateRange(range ?? getDateRangeForPreset(preset));
  };

  const clearAllFilters = () => {
    setAction('');
    setDateRangePreset(DEFAULT_DATE_PRESET);
    setDateRange(getDateRangeForPreset('all'));
    setOffset(0);
  };

  const hasActiveFilters = Boolean(
    action || (dateRangePreset !== 'all' && (dateRange.dateFrom || dateRange.dateTo))
  );

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
          <span className="text-xs" aria-hidden>
            {sortOrder === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </button>
    </th>
  );

  const { data: result, isLoading } = useQuery({
    queryKey: [
      'activity-logs',
      {
        limit: PAGE_SIZE,
        offset,
        action: action || undefined,
        date_from: dateRangePreset !== 'all' && dateRange.dateFrom ? dateRange.dateFrom : undefined,
        date_to: dateRangePreset !== 'all' && dateRange.dateTo ? dateRange.dateTo : undefined,
        sort_by: sortBy,
        order: sortOrder,
      },
    ],
    queryFn: () =>
      api.activityLogs.list({
        limit: PAGE_SIZE,
        offset,
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

  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <RequireRole allowedRoles={['admin', 'superadmin']}>
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <Link
            href={isActivityOnlyPage ? '/dashboard' : '/admin'}
            className="text-dhl-red hover:underline font-medium"
          >
            {isActivityOnlyPage ? 'Back to Dashboard' : 'Back to Admin'}
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Activity Logs</h1>
        <p className="text-gray-600 mb-4">
          User activity: login, logout, and create, save, delete actions. Shows user name for each
          entry.
        </p>

        <details
          className="mb-6 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white shadow-sm overflow-hidden"
          open={hasActiveFilters}
        >
          <summary className="font-semibold cursor-pointer text-slate-800 list-none flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 transition-colors">
            <span className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-200/80 text-slate-600">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 6h18M7 12h10M10 18h4" />
                </svg>
              </span>
              Filters
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  clearAllFilters();
                }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-200/80 hover:bg-slate-300 hover:text-slate-800 transition-colors"
              >
                Clear filters
              </button>
            )}
          </summary>
          <div className="px-5 pb-5 pt-1 border-t border-slate-100">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Date range
                </label>
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
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Date from
                    </label>
                    <input
                      type="date"
                      value={dateRange.dateFrom}
                      onChange={(e) =>
                        setDateRange((prev) => ({ ...prev, dateFrom: e.target.value }))
                      }
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                      aria-label="Date from"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Date to
                    </label>
                    <input
                      type="date"
                      value={dateRange.dateTo}
                      onChange={(e) =>
                        setDateRange((prev) => ({ ...prev, dateTo: e.target.value }))
                      }
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                      aria-label="Date to"
                    />
                  </div>
                </>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Action
                </label>
                <select
                  value={action}
                  onChange={(e) => {
                    setAction(e.target.value);
                    setOffset(0);
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400 w-full"
                >
                  <option value="">All</option>
                  <option value="login">login</option>
                  <option value="logout">logout</option>
                  <option value="create">create</option>
                  <option value="save">save</option>
                  <option value="delete">delete</option>
                </select>
              </div>
            </div>
          </div>
        </details>

        {isLoading ? (
          <p className="text-gray-500">Loading activity logs...</p>
        ) : items.length === 0 ? (
          <p className="text-gray-500">No activity logs match the filters.</p>
        ) : (
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm w-12">#</th>
                    <SortableTh label="Time" sortKey="timestamp" />
                    <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">
                      User name
                    </th>
                    <SortableTh label="Action" sortKey="action" />
                    <SortableTh label="Entity" sortKey="entity_type" />
                    <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">
                      Entity ID
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((log, index) => {
                    const displayNum = offset + index + 1;
                    const userName =
                      log.user?.name || log.user?.email || log.user_id || '—';
                    return (
                      <tr
                        key={log.id}
                        className="border-b border-gray-200 hover:bg-gray-50/50"
                      >
                        <td className="py-3 px-4 text-sm text-gray-600">{displayNum}</td>
                        <td className="py-3 px-4 text-sm text-gray-700 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{userName}</td>
                        <td className="py-3 px-4 text-sm text-gray-700">{log.action}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{log.entity_type || '—'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600 font-mono text-xs">
                          {log.entity_id || '—'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">
                          {log.details || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 border-t bg-gray-50/50">
                <p className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages} ({total} total)
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                    disabled={offset === 0}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-dhl-red border border-dhl-red/50 hover:bg-dhl-yellow/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setOffset((o) => o + PAGE_SIZE)}
                    disabled={offset + PAGE_SIZE >= total}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-dhl-red border border-dhl-red/50 hover:bg-dhl-yellow/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </RequireRole>
  );
}

export default function ActivityLogsPage() {
  return (
    <RequireAuth>
      <ActivityLogsContent />
    </RequireAuth>
  );
}
