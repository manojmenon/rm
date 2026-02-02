'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';

type RequireRoleProps = {
  children: React.ReactNode;
  allowedRoles: string[];
};

export function RequireRole({ children, allowedRoles }: RequireRoleProps) {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  if (!user) return null;
  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="card max-w-md mx-auto mt-12 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access denied</h2>
        <p className="text-gray-600 mb-4">You do not have permission to view this page.</p>
        <button onClick={() => router.push('/dashboard')} className="btn-primary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
