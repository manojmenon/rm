'use client';

import { RequireAuth } from '@/components/RequireAuth';
import { ActivityLogsContent } from '@/app/admin/activity-logs/page';

export default function ActivityLogsPage() {
  return (
    <RequireAuth>
      <ActivityLogsContent />
    </RequireAuth>
  );
}
