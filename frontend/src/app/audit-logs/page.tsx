'use client';

import { RequireAuth } from '@/components/RequireAuth';
import { AuditLogsContent } from '@/app/admin/audit-logs/page';

export default function AuditLogsPage() {
  return (
    <RequireAuth>
      <AuditLogsContent />
    </RequireAuth>
  );
}
