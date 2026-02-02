'use client';

import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { RequireAuth } from '@/components/RequireAuth';
import { RequireRole } from '@/components/RequireRole';
import { useAuthStore } from '@/store/auth';
import { api, type ProductRequest, type ProductDeletionRequest } from '@/lib/api';
import { toRequestList, isPendingStatus } from '@/lib/requestUtils';

type RequestType = 'product_creation' | 'product_deletion';

type UnifiedRequest = {
  id: string;
  request_type: RequestType;
  typeLabel: string;
  subject: string;
  subjectHref?: string;
  requested_by: string;
  requesterName: string;
  status: string;
  created_at: string;
  raw: ProductRequest | ProductDeletionRequest;
};

type PendingRequestEdits = {
  status?: 'approved' | 'rejected';
  owner_id?: string;
};
type ConfirmRequestEdit = {
  request: UnifiedRequest;
  pending: PendingRequestEdits;
};

const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  product_creation: 'Product creation',
  product_deletion: 'Product deletion',
};

function normalizeCreation(r: ProductRequest): UnifiedRequest {
  return {
    id: r.id,
    request_type: 'product_creation',
    typeLabel: REQUEST_TYPE_LABELS.product_creation,
    subject: r.name,
    requested_by: r.requested_by,
    requesterName: r.requester?.name ?? r.requested_by,
    status: r.status,
    created_at: r.created_at,
    raw: r,
  };
}

function normalizeDeletion(r: ProductDeletionRequest): UnifiedRequest {
  return {
    id: r.id,
    request_type: 'product_deletion',
    typeLabel: REQUEST_TYPE_LABELS.product_deletion,
    subject: r.product_id,
    subjectHref: `/products/${r.product_id}`,
    requested_by: r.requested_by,
    requesterName: r.requester?.name ?? r.requested_by,
    status: r.status,
    created_at: r.created_at,
    raw: r,
  };
}

function requestKey(r: UnifiedRequest) {
  return `${r.request_type}-${r.id}`;
}

export function RequestQueueContent() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isAdmin = (() => { const r = user?.role?.toLowerCase(); return r === 'admin' || r === 'superadmin'; })();
  const isRequestsPage = pathname === '/requests';

  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<RequestType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [ownerFilter, setOwnerFilter] = useState<string>('');
  const [editingRequestKey, setEditingRequestKey] = useState<string | null>(null);
  const [hoveredRequestKey, setHoveredRequestKey] = useState<string | null>(null);
  const [pendingEditsByKey, setPendingEditsByKey] = useState<Record<string, PendingRequestEdits>>({});
  const [confirmRequestEdit, setConfirmRequestEdit] = useState<ConfirmRequestEdit | null>(null);
  const [confirmTyped, setConfirmTyped] = useState('');

  const { data: creationRequests, isLoading: loadingCreation } = useQuery({
    queryKey: ['product-requests'],
    queryFn: () => api.requests.list(),
  });

  const { data: deletionRequests, isLoading: loadingDeletion } = useQuery({
    queryKey: ['deletion-requests'],
    queryFn: () => api.deletionRequests.list(),
  });

  const creationList = toRequestList(creationRequests);
  const deletionList = toRequestList(deletionRequests);

  const unified = useMemo(() => {
    const creation = creationList.map((r) => normalizeCreation(r as ProductRequest));
    const deletion = deletionList.map((r) => normalizeDeletion(r as ProductDeletionRequest));
    const all: UnifiedRequest[] = [...creation, ...deletion].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    if (typeFilter === 'all') return all;
    return all.filter((r) => r.request_type === typeFilter);
  }, [creationList, deletionList, typeFilter]);

  const approveCreationMutation = useMutation({
    mutationFn: ({ id, approved, owner_id }: { id: string; approved: boolean; owner_id?: string }) =>
      api.requests.approve(id, { approved, owner_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-requests'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      closeConfirmModal();
    },
  });

  const approveDeletionMutation = useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) =>
      api.deletionRequests.approve(id, { approved }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletion-requests'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      closeConfirmModal();
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.list(),
    enabled: isAdmin,
  });

  const showOwnerFilter = isAdmin && users.length > 0;

  const closeConfirmModal = () => {
    setConfirmRequestEdit(null);
    setConfirmTyped('');
  };

  const handleConfirmApply = () => {
    if (!confirmRequestEdit) return;
    const { request, pending } = confirmRequestEdit;
    const subjectMatch = confirmTyped.trim() === request.subject;
    if (!subjectMatch) return;
    if (request.request_type === 'product_creation') {
      if (pending.status === 'approved') {
        approveCreationMutation.mutate({
          id: request.id,
          approved: true,
          owner_id: pending.owner_id || request.requested_by || undefined,
        });
      } else if (pending.status === 'rejected') {
        approveCreationMutation.mutate({ id: request.id, approved: false });
      }
    } else {
      approveDeletionMutation.mutate({
        id: request.id,
        approved: pending.status === 'approved',
      });
    }
    setPendingEditsByKey((prev) => {
      const next = { ...prev };
      delete next[requestKey(request)];
      return next;
    });
  };

  const handleRowLeave = (r: UnifiedRequest) => {
    setHoveredRequestKey(null);
    const key = requestKey(r);
    if (editingRequestKey !== key) return;
    setEditingRequestKey(null);
    const pending = pendingEditsByKey[key];
    if (pending && (pending.status === 'approved' || pending.status === 'rejected')) {
      setConfirmRequestEdit({ request: r, pending: { ...pending } });
      setConfirmTyped('');
      setPendingEditsByKey((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const isConfirmValid =
    confirmRequestEdit &&
    confirmTyped.trim() === confirmRequestEdit.request.subject &&
    (confirmRequestEdit.request.request_type !== 'product_creation' ||
      confirmRequestEdit.pending.status !== 'approved' ||
      !!confirmRequestEdit.pending.owner_id ||
      !!confirmRequestEdit.request.requested_by);
  const isLoading = loadingCreation || loadingDeletion;
  const isMutating = approveCreationMutation.isPending || approveDeletionMutation.isPending;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Request queue</h1>
        <Link href={isRequestsPage ? '/dashboard' : '/admin'} className="btn-secondary">
          {isRequestsPage ? 'Back to Dashboard' : 'Back to Admin'}
        </Link>
      </div>
      <p className="text-gray-600 mb-4">
        {isRequestsPage
          ? 'Your product creation requests and deletion requests for products you own. Only admins can approve or reject.'
          : 'All requests (product creation and product deletion) in one queue. Filter by type below.'}
      </p>

      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Request type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as RequestType | 'all')}
            className="input py-1.5 text-sm w-auto"
          >
            <option value="all">All</option>
            <option value="product_creation">Product creation</option>
            <option value="product_deletion">Product deletion</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input py-1.5 text-sm w-auto min-w-[100px]"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Date range</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="input py-1.5 text-sm w-auto"
            aria-label="From date"
          />
          <span className="text-gray-500 text-sm">–</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="input py-1.5 text-sm w-auto"
            aria-label="To date"
          />
        </div>
        {showOwnerFilter && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Owner</label>
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="input py-1.5 text-sm w-auto min-w-[140px]"
            >
              <option value="">All</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading requests...</p>
      ) : unified.length === 0 ? (
        <p className="text-gray-500">
          {typeFilter === 'all' ? 'No requests.' : `No ${REQUEST_TYPE_LABELS[typeFilter as RequestType].toLowerCase()} requests.`}
        </p>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto -mx-px">
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Type</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Subject</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Requested by</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Owner</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                {isAdmin && <th className="text-right py-3 px-4 font-medium text-gray-700 w-10">Edit</th>}
              </tr>
            </thead>
            <tbody>
              {unified.map((r) => {
                const key = requestKey(r);
                const isEditing = editingRequestKey === key;
                const pending = pendingEditsByKey[key];
                const statusDisplay = pending?.status ?? r.status;
                // Default owner to requester for product creation requests
                const ownerIdDisplay =
                  pending?.owner_id ?? (r.request_type === 'product_creation' ? r.requested_by ?? '' : '') ?? '';
                const isPending = isPendingStatus(r);
                const showEdit = isAdmin && isPending && (hoveredRequestKey === key || isEditing);
                return (
                  <tr
                    key={key}
                    className="border-b last:border-0 hover:bg-gray-50/50"
                    onMouseEnter={() => isPending && setHoveredRequestKey(key)}
                    onMouseLeave={() => handleRowLeave(r)}
                  >
                    <td className="py-3 px-4">
                      <span
                        className={
                          r.request_type === 'product_creation'
                            ? 'text-blue-600 font-medium text-sm'
                            : 'text-amber-700 font-medium text-sm'
                        }
                      >
                        {r.typeLabel}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {r.subjectHref ? (
                        <Link href={r.subjectHref} className="text-blue-600 hover:underline">
                          {r.subject}
                        </Link>
                      ) : (
                        r.subject
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm">{r.requesterName}</td>
                    <td className="py-3 px-4">
                      {isAdmin && isPending && isEditing ? (
                        <select
                          value={(statusDisplay ?? 'pending').toString().toLowerCase()}
                          onChange={(e) => {
                            const v = e.target.value as 'pending' | 'approved' | 'rejected';
                            setPendingEditsByKey((prev) => ({
                              ...prev,
                              [key]: {
                                ...prev[key],
                                ...(v === 'pending' ? { status: undefined } : { status: v }),
                              },
                            }));
                          }}
                          className="input py-1 text-sm w-auto min-w-[100px]"
                          disabled={isMutating}
                          title="Set status"
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      ) : (
                        <span
                          className={
                            isPendingStatus(r)
                              ? 'text-amber-600 text-sm font-medium'
                              : (r.status ?? '').toLowerCase() === 'approved'
                                ? 'text-green-600 text-sm'
                                : (r.status ?? '').toLowerCase() === 'rejected'
                                  ? 'text-red-600 text-sm'
                                  : 'text-gray-600 text-sm'
                          }
                        >
                          {isPendingStatus(r)
                            ? 'Pending'
                            : (r.status ?? '').toLowerCase() === 'approved'
                            ? 'Approved'
                            : (r.status ?? '').toLowerCase() === 'rejected'
                            ? 'Rejected'
                            : r.status ?? '—'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {isAdmin && r.request_type === 'product_creation' && isPending && isEditing ? (
                        ((pending?.status ?? r.status) ?? '').toLowerCase() === 'approved' ? (
                          <select
                            value={ownerIdDisplay}
                            onChange={(e) =>
                              setPendingEditsByKey((prev) => ({
                                ...prev,
                                [key]: { ...prev[key], owner_id: e.target.value },
                              }))
                            }
                            className="input py-1 text-sm w-auto min-w-[140px]"
                            disabled={isMutating}
                            title="Assign owner when approving (defaults to requester)"
                          >
                            <option value="">Select owner</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.role})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )
                      ) : r.request_type === 'product_creation' && isPending ? (
                        <span className="text-gray-600 text-sm" title="Defaults to requester when approved">
                          {ownerIdDisplay
                            ? users.find((u) => u.id === ownerIdDisplay)?.name ?? r.requesterName
                            : r.requesterName}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    {isAdmin && (
                    <td className="py-3 px-4 text-right">
                      {showEdit && (
                        <button
                          type="button"
                          onClick={() =>
                            setEditingRequestKey((k) => (k === key ? null : key))
                          }
                          className="p-1.5 rounded text-dhl-red hover:bg-dhl-yellow/25 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-dhl-red"
                          title={isEditing ? 'Done editing' : 'Edit status and owner'}
                          aria-label={isEditing ? 'Done editing' : 'Edit'}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            <path d="m15 5 4 4" />
                          </svg>
                        </button>
                      )}
                    </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {isAdmin && confirmRequestEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-request-edit-title">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 id="confirm-request-edit-title" className="text-lg font-semibold text-gray-900 mb-2">
              Confirm changes
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              You have pending changes for this request. To apply, type the <strong>request subject</strong> below.
              {confirmRequestEdit.request.request_type === 'product_creation'
                ? ' For creation requests this is the request name. When approving, you must select an owner.'
                : ' For deletion requests this is the product ID.'}
            </p>
            <label className="block text-gray-700 text-sm font-medium mb-1">
              Request subject
            </label>
            <input
              type="text"
              value={confirmTyped}
              onChange={(e) => setConfirmTyped(e.target.value)}
              className="input mb-4"
              placeholder={confirmRequestEdit.request.subject}
              aria-label="Request subject"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={closeConfirmModal} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApply}
                disabled={!isConfirmValid || isMutating}
                className="btn-primary disabled:opacity-50"
              >
                {isMutating ? 'Applying…' : 'Apply'}
              </button>
            </div>
            {(approveCreationMutation.isError || approveDeletionMutation.isError) && (
              <p className="text-red-600 text-sm mt-2" role="alert">
                {approveCreationMutation.error?.message ?? approveDeletionMutation.error?.message ?? 'Update failed'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminRequestsPage() {
  return (
    <RequireAuth>
      <RequireRole allowedRoles={['admin', 'superadmin']}>
        <RequestQueueContent />
      </RequireRole>
    </RequireAuth>
  );
}
