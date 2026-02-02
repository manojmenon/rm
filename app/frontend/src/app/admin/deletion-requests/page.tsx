'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { RequireAuth } from '@/components/RequireAuth';
import { RequireRole } from '@/components/RequireRole';
import { api, type ProductDeletionRequest } from '@/lib/api';
import { toRequestList, isPendingStatus } from '@/lib/requestUtils';

function DeletionRequestsContent() {
  const queryClient = useQueryClient();
  const { data: deletionData, isLoading } = useQuery({
    queryKey: ['deletion-requests'],
    queryFn: () => api.deletionRequests.list(),
  });
  const requests = toRequestList(deletionData) as ProductDeletionRequest[];

  const approveMutation = useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) =>
      api.deletionRequests.approve(id, { approved }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletion-requests'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  if (isLoading) {
    return <p className="text-gray-500">Loading deletion requests...</p>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Product deletion requests</h1>
        <Link href="/admin" className="btn-secondary">
          Back to Admin
        </Link>
      </div>
      <p className="text-gray-600 mb-4">
        Approve or reject requests to delete products. When approved, all product versions and the
        product are deleted.
      </p>
      {requests.length === 0 ? (
        <p className="text-gray-500">No deletion requests.</p>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Product</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Requested by</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50/50">
                  <td className="py-3 px-4">
                    <Link
                      href={`/products/${r.product_id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {r.product_id}
                    </Link>
                  </td>
                  <td className="py-3 px-4">
                    {r.requester?.name ?? r.requested_by}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={
                        isPendingStatus(r)
                          ? 'text-amber-600'
                          : (r.status ?? '').toLowerCase() === 'approved'
                            ? 'text-green-600'
                            : 'text-gray-600'
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
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-500">{r.created_at}</td>
                  <td className="py-3 px-4 text-right">
                    {isPendingStatus(r) && (
                      <span className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => approveMutation.mutate({ id: r.id, approved: true })}
                          disabled={approveMutation.isPending}
                          className="text-green-600 hover:underline text-sm"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => approveMutation.mutate({ id: r.id, approved: false })}
                          disabled={approveMutation.isPending}
                          className="text-red-600 hover:underline text-sm"
                        >
                          Reject
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function DeletionRequestsPage() {
  return (
    <RequireAuth>
      <RequireRole allowedRoles={['admin', 'superadmin']}>
        <DeletionRequestsContent />
      </RequireRole>
    </RequireAuth>
  );
}
