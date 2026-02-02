'use client';

import { RequireAuth } from '@/components/RequireAuth';
import { RequireRole } from '@/components/RequireRole';
import { AuditLogsContent } from '@/components/AuditLogsContent';

export default function AuditLogsPage() {
  return (
    <RequireAuth>
      <RequireRole allowedRoles={['admin', 'superadmin']}>
        <AuditLogsContent />
      </RequireRole>
    </RequireAuth>
  );
}
