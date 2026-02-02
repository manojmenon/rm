'use client';

import { RequireAuth } from '@/components/RequireAuth';
import { RequireRole } from '@/components/RequireRole';
import { RequestQueueContent } from '@/components/RequestQueueContent';

export default function AdminRequestsPage() {
  return (
    <RequireAuth>
      <RequireRole allowedRoles={['admin', 'superadmin']}>
        <RequestQueueContent />
      </RequireRole>
    </RequireAuth>
  );
}
