'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RequireAuth } from '@/components/RequireAuth';
import { api, type Notification } from '@/lib/api';

function NotificationsContent() {
  const queryClient = useQueryClient();
  const [viewArchived, setViewArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkAction, setIsBulkAction] = useState(false);

  const { data: list, isLoading } = useQuery({
    queryKey: ['notifications-page', viewArchived],
    queryFn: () => api.notifications.list({ limit: 100, offset: 0, archived: viewArchived }),
    staleTime: 0,
  });

  const items = list?.items ?? [];
  const hasUnread = items.some((n: Notification) => !n.read_at);
  const allIds = items.map((n: Notification) => n.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);
  const toggleViewArchived = useCallback((archived: boolean) => {
    setViewArchived(archived);
    setSelectedIds(new Set());
  }, []);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-page'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });
  const markReadAllMutation = useMutation({
    mutationFn: () => api.notifications.markReadAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-page'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });
  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.notifications.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-page'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.notifications.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-page'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  const toggleSelectAll = () => {
    if (allSelected) {
      clearSelection();
    } else {
      setSelectedIds(new Set(allIds));
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

  const handleArchiveSelected = async () => {
    if (!someSelected || viewArchived) return;
    setIsBulkAction(true);
    try {
      await Promise.allSettled(Array.from(selectedIds).map((id) => api.notifications.archive(id)));
      queryClient.invalidateQueries({ queryKey: ['notifications-page'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      clearSelection();
    } finally {
      setIsBulkAction(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!someSelected) return;
    setIsBulkAction(true);
    try {
      await Promise.allSettled(Array.from(selectedIds).map((id) => api.notifications.delete(id)));
      queryClient.invalidateQueries({ queryKey: ['notifications-page'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      clearSelection();
    } finally {
      setIsBulkAction(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
        <Link href="/dashboard" className="btn-secondary">
          Back to Dashboard
        </Link>
      </div>
      <p className="text-gray-600 mb-4">
        Notifications when you submit product creation or deletion requests (admins are notified), and when admins approve or reject them or change product status. Use Select all to archive or delete multiple items. Deleted items are removed from both Inbox and Archived.
      </p>

      <div className="flex border-b border-gray-200 mb-4">
        <button
          type="button"
          onClick={() => toggleViewArchived(false)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${!viewArchived ? 'border-dhl-red text-dhl-red' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Inbox
        </button>
        <button
          type="button"
          onClick={() => toggleViewArchived(true)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${viewArchived ? 'border-dhl-red text-dhl-red' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Archived
        </button>
      </div>

      {/* Toolbar: Mark all read (Inbox) + Select All + Archive + Delete */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        {!viewArchived && hasUnread && (
          <button
            type="button"
            onClick={() => markReadAllMutation.mutate()}
            disabled={markReadAllMutation.isPending}
            className="text-sm font-medium text-dhl-red hover:underline disabled:opacity-50"
          >
            Mark all as read
          </button>
        )}
        {items.length > 0 && (
          <>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected && !allSelected;
                }}
                onChange={toggleSelectAll}
                className="rounded border-gray-300 text-dhl-red focus:ring-dhl-red"
                aria-label="Select all"
              />
              <span className="text-sm font-medium text-gray-700">Select all</span>
            </label>
            {someSelected && (
              <>
                {!viewArchived && (
                  <button
                    type="button"
                    onClick={handleArchiveSelected}
                    disabled={isBulkAction}
                    className="btn-secondary text-sm py-1.5"
                  >
                    Archive ({selectedIds.size})
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  disabled={isBulkAction}
                  className="text-sm py-1.5 px-3 rounded-lg font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 disabled:opacity-50"
                >
                  Delete ({selectedIds.size})
                </button>
                <span className="text-sm text-gray-500">
                  {selectedIds.size} selected
                </span>
              </>
            )}
          </>
        )}
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading notifications…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500">
          {viewArchived ? 'No archived notifications.' : 'No notifications.'}
        </p>
      ) : (
        <div className="card divide-y divide-gray-100 overflow-hidden p-0">
          {items.map((n: Notification) => (
            <div
              key={n.id}
              className={`px-4 py-4 hover:bg-gray-50/50 flex items-start gap-3 ${!n.read_at ? 'bg-amber-50/30' : ''}`}
            >
              <label className="flex items-center pt-0.5 shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.has(n.id)}
                  onChange={() => toggleSelectOne(n.id)}
                  className="rounded border-gray-300 text-dhl-red focus:ring-dhl-red"
                  aria-label={`Select notification ${n.title}`}
                />
              </label>
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${!n.read_at ? 'font-semibold text-gray-900' : 'text-gray-900'}`}>
                  {n.title}
                </p>
                <p className="text-sm text-gray-600 mt-1">{n.message}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!n.read_at && (
                  <button
                    type="button"
                    onClick={() => markReadMutation.mutate(n.id)}
                    disabled={markReadMutation.isPending}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    Mark read
                  </button>
                )}
                {!viewArchived && !n.archived_at && (
                  <button
                    type="button"
                    onClick={() => archiveMutation.mutate(n.id)}
                    disabled={archiveMutation.isPending}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    Archive
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(n.id)}
                  disabled={deleteMutation.isPending}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <RequireAuth>
      <NotificationsContent />
    </RequireAuth>
  );
}
