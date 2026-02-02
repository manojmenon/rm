'use client';

import { RequireAuth } from '@/components/RequireAuth';
import { AuditLogsContent } from '@/components/AuditLogsContent';

export default function AuditLogsPage() {
  return (
    <RequireAuth>
      <AuditLogsContent />
    </RequireAuth>
  );
}
