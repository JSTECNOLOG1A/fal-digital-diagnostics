/**
 * RBAC — Central Authorization Module
 * =====================================================================
 * Pure functions that encode the FAL platform's role-based access control
 * decisions. These are the SAME functions used in runtime guards (backend
 * functions and frontend route guards).
 *
 * IMPORTANT: All role checks use resolveAppRole(user) — never user.role directly.
 *   app_role is the FAL operational role (hq_admin, tenant_admin, consultant, client_viewer).
 *   role is the Base44 technical role (admin, user) — used only for the admin→hq_admin bridge.
 *
 * Roles (app_role):
 *   hq_admin      — global admin, can access any tenant
 *   tenant_admin  — admin scoped to own tenant
 *   consultant    — operational user scoped to own tenant
 *   client_viewer — read-only client portal user
 */

import { resolveAppRole } from '@/lib/access-role';

export const ROLES = {
  HQ_ADMIN: 'hq_admin',
  TENANT_ADMIN: 'tenant_admin',
  CONSULTANT: 'consultant',
  CLIENT_VIEWER: 'client_viewer',
};

// ── Role sets (app_role values only) ──────────────────────────────────────────
const HQ_ROLES = new Set([ROLES.HQ_ADMIN]);
const ADMIN_ROLES = new Set([ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN]);
const WRITE_ROLES = new Set([ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT]);
const READ_ROLES = new Set([ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT, ROLES.CLIENT_VIEWER]);
const DELETE_ROLES = new Set([ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN]);

// ── Core predicates ───────────────────────────────────────────────────────────

/**
 * Returns true if the user is a global admin (hq_admin).
 * @param {{ app_role?: string, role?: string }} user
 * @returns {boolean}
 */
export function isHQ(user) {
  return resolveAppRole(user) === ROLES.HQ_ADMIN;
}

/**
 * Returns true if the user has any admin-level role (hq_admin or tenant_admin).
 * @param {{ app_role?: string, role?: string }} user
 * @returns {boolean}
 */
export function isAdmin(user) {
  return ADMIN_ROLES.has(resolveAppRole(user));
}

/**
 * Returns true if the user can write (create/update/delete) operational data.
 * Excludes client_viewer.
 * @param {{ app_role?: string, role?: string }} user
 * @returns {boolean}
 */
export function canWrite(user) {
  return WRITE_ROLES.has(resolveAppRole(user));
}

/**
 * Returns true if the user can read operational data.
 * Includes client_viewer (read-only).
 * @param {{ app_role?: string, role?: string }} user
 * @returns {boolean}
 */
export function canRead(user) {
  return READ_ROLES.has(resolveAppRole(user));
}

/**
 * Returns true if the user can perform destructive operations (purge, delete).
 * Only hq_admin and tenant_admin.
 * @param {{ app_role?: string, role?: string }} user
 * @returns {boolean}
 */
export function canDelete(user) {
  return DELETE_ROLES.has(resolveAppRole(user));
}

// ── Tenant access ─────────────────────────────────────────────────────────────

/**
 * Asserts that the user has access to the given tenant.
 * Deny-by-default: a user without tenant_id is NOT authorized (no implicit bypass).
 * @param {{ app_role?: string, role?: string, tenant_id?: string }} user
 * @param {string} entityTenantId
 * @throws {{ status: number, message: string }} when access is denied
 */
export function assertTenantAccess(user, entityTenantId) {
  if (isHQ(user)) return; // HQ admins can access any tenant
  const appRole = resolveAppRole(user);
  if (!appRole || !user || !user.tenant_id) {
    throw Object.assign(new Error('Forbidden: user has no tenant_id or app_role'), { status: 403 });
  }
  if (user.tenant_id !== entityTenantId) {
    throw Object.assign(new Error('Forbidden: tenant mismatch'), { status: 403 });
  }
}

/**
 * Non-throwing version of assertTenantAccess.
 * @param {{ app_role?: string, role?: string, tenant_id?: string }} user
 * @param {string} entityTenantId
 * @returns {boolean}
 */
export function hasTenantAccess(user, entityTenantId) {
  try {
    assertTenantAccess(user, entityTenantId);
    return true;
  } catch {
    return false;
  }
}

// ── Resource-level permissions ────────────────────────────────────────────────

export function canManageGroup(user) { return canWrite(user); }
export function canManageDiagnosis(user) { return canWrite(user); }
export function canManageQuestionnaire(user) { return canWrite(user); }
export function canManageConsolidation(user) { return canWrite(user); }
export function canManageActionPlan(user) { return canWrite(user); }
export function canManageReviews(user) { return canWrite(user); }
export function canManageReports(user) { return canWrite(user); }

/**
 * User management (invite/update/delete users)
 * Only admin-level roles (hq_admin and tenant_admin)
 */
export function canManageUsers(user) { return isAdmin(user); }

/**
 * Destructive operations (purge data, delete entities)
 * Only admin-level roles
 */
export function canDeleteEntity(user) { return canDelete(user); }

/**
 * Tenant switching (HQ only)
 */
export function canSwitchTenant(user) { return isHQ(user); }

/**
 * Client portal access (client_viewer or any internal role)
 */
export function canAccessClientPortal(user) { return canRead(user); }

// ── Full permission matrix ────────────────────────────────────────────────────

/**
 * Returns the full permission matrix for a given user's app_role.
 * @param {{ app_role?: string, role?: string }} user
 * @returns {Record<string, 'ALLOW' | 'DENY' | 'READ-ONLY' | 'N/A'>}
 */
export function getPermissionMatrix(user) {
  const appRole = resolveAppRole(user);
  const _isHQ = appRole === ROLES.HQ_ADMIN;
  const _isAdmin = ADMIN_ROLES.has(appRole);
  const _canWrite = WRITE_ROLES.has(appRole);
  const _canRead = READ_ROLES.has(appRole);

  if (!_canRead) {
    // Unknown/unclassified role — deny everything
    return {};
  }

  /** @type {Record<string, 'ALLOW' | 'DENY' | 'READ-ONLY' | 'N/A'>} */
  const m = {};
  const areas = [
    'group', 'company', 'unit', 'diagnosis', 'questionnaire',
    'financial', 'consolidation', 'actionplan', 'reviews',
    'reports', 'users', 'exclusions', 'tenant_switch',
  ];

  for (const area of areas) {
    if (area === 'tenant_switch') {
      m[area] = _isHQ ? 'ALLOW' : 'DENY';
    } else if (area === 'users') {
      m[area] = _isAdmin ? 'ALLOW' : 'DENY';
    } else if (area === 'exclusions') {
      m[area] = _isAdmin ? 'ALLOW' : 'DENY';
    } else {
      m[area] = _canWrite ? 'ALLOW' : 'READ-ONLY';
    }
  }

  return m;
}

// ── Re-exports for convenience ────────────────────────────────────────────────
export { resolveAppRole, APP_ROLES } from '@/lib/access-role';