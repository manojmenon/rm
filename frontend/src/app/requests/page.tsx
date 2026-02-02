'use client';

import { RequireAuth } from '@/components/RequireAuth';
import { RequestQueueContent } from '@/components/RequestQueueContent';

export default function RequestsPage() {
  return (
    <RequireAuth>
      <RequestQueueContent />
    </RequireAuth>
  );
}
