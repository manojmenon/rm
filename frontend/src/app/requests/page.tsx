'use client';

import { RequireAuth } from '@/components/RequireAuth';
import { RequestQueueContent } from '@/app/admin/requests/page';

export default function RequestsPage() {
  return (
    <RequireAuth>
      <RequestQueueContent />
    </RequireAuth>
  );
}
