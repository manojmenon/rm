/** Role hierarchy: user < owner < admin < superadmin */

export function isAdminOrAbove(role: string | undefined): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return r === 'admin' || r === 'superadmin';
}

export const ADMIN_OR_SUPERADMIN_ROLES = ['admin', 'superadmin'] as const;
