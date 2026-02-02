'use client';

import { RequireAuth } from '@/components/RequireAuth';
import { ActivityLogsContent } from '@/components/ActivityLogsContent';

export default function ActivityLogsPage() {
  return (
    <RequireAuth>
      <ActivityLogsContent />
    </RequireAuth>
  );
}
