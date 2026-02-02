'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { RequireAuth } from '@/components/RequireAuth';
import { RequireRole } from '@/components/RequireRole';
import { api } from '@/lib/api';
import { getPendingCount } from '@/lib/requestUtils';

function AdminContent() {
  const { data: creationRequests } = useQuery({
    queryKey: ['product-requests'],
    queryFn: () => api.requests.list(),
  });
  const { data: deletionRequests } = useQuery({
    queryKey: ['deletion-requests'],
    queryFn: () => api.deletionRequests.list(),
  });
  const pendingCount = getPendingCount(creationRequests, deletionRequests);

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Admin</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/admin/requests" className="card hover:shadow-lg transition-shadow relative">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            Request queue
            {pendingCount > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full text-xs font-bold text-white bg-amber-500"
                aria-label={`${pendingCount} pending request${pendingCount === 1 ? '' : 's'}`}
              >
                {pendingCount}
              </span>
            )}
          </h3>
          <p className="text-gray-600 mt-1">All requests in one queue: product creation and product deletion, classified by type</p>
        </Link>
        <Link href="/products" className="card hover:shadow-lg transition-shadow">
          <h3 className="font-semibold text-lg">Products</h3>
          <p className="text-gray-600 mt-1">Manage products, lifecycle (Active/Suspend/End of roadmap), assign owners</p>
        </Link>
        <Link href="/admin/audit-logs" className="card hover:shadow-lg transition-shadow">
          <h3 className="font-semibold text-lg">Audit logs</h3>
          <p className="text-gray-600 mt-1">View who changed what and when</p>
        </Link>
        <Link href="/admin/users" className="card hover:shadow-lg transition-shadow">
          <h3 className="font-semibold text-lg">Users &amp; Organization</h3>
          <p className="text-gray-600 mt-1">Define holding companies, companies, functions, departments, teams; assign users to teams and managers (direct and dotted-line)</p>
        </Link>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireAuth>
      <RequireRole allowedRoles={['admin', 'superadmin']}>
        <AdminContent />
      </RequireRole>
    </RequireAuth>
  );
}
