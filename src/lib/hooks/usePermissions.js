/**
 * usePermissions — Runtime RBAC Hook (SEG-03)
 * =====================================================================
 * Connects the central rbac.js module to the ACTUAL runtime user context.
 * This is the bridge between the theoretical permission matrix and the
 * live application state.
 *
 * Architecture: Alternative C (backend as authority) + frontend adapter.
 *   - Backend functions enforce tenant guards (SEG-02) — the real authority.
 *   - This hook derives frontend capabilities from the authenticated user.
 *   - UI uses these capabilities to show/hide/disable elements.
 *   - Direct API access (bypassing UI) is still denied by backend guards.
 *
 * Consumers (runtime):
 *   - PermissionGuard component (UI conditional rendering)
 *   - RoleRoute component (route-level role gating)
 *   - Layout sidebar (nav item visibility)
 *   - Action buttons (disabled state for read-only roles)
 */
import { useMemo } from 'react';
import { useTenant } from '@/components/shared/TenantContext';
import {
  isHQ, isAdmin, canWrite, canRead, canDelete,
  canManageGroup, canManageDiagnosis, canManageQuestionnaire,
  canManageConsolidation, canManageActionPlan, canManageReviews,
  canManageReports, canManageUsers, canDeleteEntity,
  canSwitchTenant, canAccessClientPortal,
  hasTenantAccess, getPermissionMatrix,
} from '@/lib/rbac';
import { resolveAppRole } from '@/lib/access-role';

/**
 * @returns {{
 *   user: object|null,
 *   role: string,
 *   appRole: string|null,
 *   tenantId: string|null,
 *   isHQ: boolean,
 *   isAdmin: boolean,
 *   canWrite: boolean,
 *   canRead: boolean,
 *   canDelete: boolean,
 *   canManageGroup: boolean,
 *   canManageDiagnosis: boolean,
 *   canManageQuestionnaire: boolean,
 *   canManageConsolidation: boolean,
 *   canManageActionPlan: boolean,
 *   canManageReviews: boolean,
 *   canManageReports: boolean,
 *   canManageUsers: boolean,
 *   canDeleteEntity: boolean,
 *   canSwitchTenant: boolean,
 *   canAccessClientPortal: boolean,
 *   hasTenantAccess: (entityTenantId: string) => boolean,
 *   permissionMatrix: Record<string, string>,
 *   getAreaPermission: (area: string) => string,
 * }}
 */
export function usePermissions() {
  const { user, tenantId, isHQ: ctxIsHQ } = useTenant();

  return useMemo(() => {
    const safeUser = user || { role: null, tenant_id: null };

    return {
      // Identity
      user: safeUser,
      role: safeUser.role || null, // built-in Base44 role (admin/user)
      appRole: resolveAppRole(safeUser), // FAL operational role
      tenantId: tenantId || safeUser.tenant_id || null,

      // Role predicates (from rbac.js — SAME functions tested in rbac.test.js)
      isHQ: isHQ(safeUser),
      isAdmin: isAdmin(safeUser),
      canWrite: canWrite(safeUser),
      canRead: canRead(safeUser),
      canDelete: canDelete(safeUser),

      // Resource permissions (from rbac.js)
      canManageGroup: canManageGroup(safeUser),
      canManageDiagnosis: canManageDiagnosis(safeUser),
      canManageQuestionnaire: canManageQuestionnaire(safeUser),
      canManageConsolidation: canManageConsolidation(safeUser),
      canManageActionPlan: canManageActionPlan(safeUser),
      canManageReviews: canManageReviews(safeUser),
      canManageReports: canManageReports(safeUser),
      canManageUsers: canManageUsers(safeUser),
      canDeleteEntity: canDeleteEntity(safeUser),
      canSwitchTenant: canSwitchTenant(safeUser),
      canAccessClientPortal: canAccessClientPortal(safeUser),

      // Tenant access check (runtime — uses actual user tenant_id)
      hasTenantAccess: (entityTenantId) => hasTenantAccess(safeUser, entityTenantId),

      // Full matrix (for debugging / matrix-based UI decisions)
      permissionMatrix: getPermissionMatrix(safeUser),
      getAreaPermission: (area) => {
        const m = getPermissionMatrix(safeUser);
        return m[area] || 'N/A';
      },

      // Context flag passthrough (for convenience)
      _ctxIsHQ: ctxIsHQ,
    };
  }, [user, tenantId, ctxIsHQ]);
}