export const ROLES = {
  HQ_ADMIN: 'hq_admin',
  TENANT_ADMIN: 'tenant_admin',
  CONSULTANT: 'consultant',
  CLIENT_VIEWER: 'client_viewer',
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: AppRole[] = Object.values(ROLES);

const HQ_ROLES = new Set<AppRole>([ROLES.HQ_ADMIN]);
const ADMIN_ROLES = new Set<AppRole>([ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN]);
const WRITE_ROLES = new Set<AppRole>([
  ROLES.HQ_ADMIN,
  ROLES.TENANT_ADMIN,
  ROLES.CONSULTANT,
]);
const READ_ROLES = new Set<AppRole>([
  ROLES.HQ_ADMIN,
  ROLES.TENANT_ADMIN,
  ROLES.CONSULTANT,
  ROLES.CLIENT_VIEWER,
]);
const DELETE_ROLES = new Set<AppRole>([ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN]);
const INVITE_ROLES = new Set<AppRole>([ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN]);

export function isHQ(role: AppRole): boolean {
  return HQ_ROLES.has(role);
}

export function isAdmin(role: AppRole): boolean {
  return ADMIN_ROLES.has(role);
}

export function canWrite(role: AppRole): boolean {
  return WRITE_ROLES.has(role);
}

export function canRead(role: AppRole): boolean {
  return READ_ROLES.has(role);
}

export function canDelete(role: AppRole): boolean {
  return DELETE_ROLES.has(role);
}

export function canInvite(role: AppRole): boolean {
  return INVITE_ROLES.has(role);
}

export function canAccessTenant(
  role: AppRole,
  userTenantId: string | null,
  targetTenantId: string,
): boolean {
  if (isHQ(role)) return true;
  return Boolean(userTenantId && userTenantId === targetTenantId);
}
