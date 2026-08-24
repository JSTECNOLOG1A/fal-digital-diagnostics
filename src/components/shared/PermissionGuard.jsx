/**
 * PermissionGuard — Runtime UI Guard (SEG-03)
 * =====================================================================
 * Conditionally renders children based on the runtime user's permissions.
 * This is a REAL runtime consumer of usePermissions() → rbac.js.
 *
 * Usage:
 *   <PermissionGuard area="users">
 *     <Button>Invite User</Button>
 *   </PermissionGuard>
 *
 *   <PermissionGuard requireDelete>
 *     <DeleteButton />
 *   </PermissionGuard>
 *
 *   <PermissionGuard area="diagnosis" fallback={<ReadOnlyBadge />}>
 *     <DiagnosisEditor />
 *   </PermissionGuard>
 */
import React from 'react';
import { usePermissions } from '@/lib/hooks/usePermissions';

/**
 * @param {Object} props
 * @param {any} props.children
 * @param {string=} props.area — area key: 'group'|'diagnosis'|'questionnaire'|'consolidation'|'actionplan'|'reviews'|'reports'|'users'|'exclusions'|'tenant_switch'
 * @param {boolean=} props.requireWrite — require write permission (canManage*)
 * @param {boolean=} props.requireDelete — require delete permission (isAdmin)
 * @param {boolean=} props.requireHQ — require HQ role
 * @param {boolean=} props.requireTenantSwitch — require tenant switch capability
 * @param {string=} props.entityTenantId — require access to this specific tenant
 * @param {any=} props.fallback — element to render when denied (default: null)
 * @param {boolean=} props.disableInsteadOfHide — render children but disabled
 */
export default function PermissionGuard({
  children,
  area,
  requireWrite = false,
  requireDelete = false,
  requireHQ = false,
  requireTenantSwitch = false,
  entityTenantId,
  fallback = null,
  disableInsteadOfHide = false,
}) {
  const perms = usePermissions();

  let allowed = true;

  if (requireHQ) allowed = allowed && perms.isHQ;
  if (requireDelete) allowed = allowed && perms.canDeleteEntity;
  if (requireTenantSwitch) allowed = allowed && perms.canSwitchTenant;

  if (area) {
    const areaMap = {
      group: perms.canManageGroup,
      company: perms.canManageGroup,
      unit: perms.canManageGroup,
      diagnosis: perms.canManageDiagnosis,
      questionnaire: perms.canManageQuestionnaire,
      financial: perms.canManageDiagnosis,
      consolidation: perms.canManageConsolidation,
      actionplan: perms.canManageActionPlan,
      reviews: perms.canManageReviews,
      reports: perms.canManageReports,
      users: perms.canManageUsers,
      exclusions: perms.canDeleteEntity,
      tenant_switch: perms.canSwitchTenant,
    };
    allowed = allowed && (areaMap[area] ?? false);
  }

  if (requireWrite) {
    allowed = allowed && perms.canWrite;
  }

  if (entityTenantId) {
    allowed = allowed && perms.hasTenantAccess(entityTenantId);
  }

  if (allowed) {
    return <>{children}</>;
  }

  if (disableInsteadOfHide) {
    // Clone the child element and add disabled state
    return React.cloneElement(React.Children.only(children), {
      disabled: true,
      style: { ...children?.props?.style, opacity: 0.5, cursor: 'not-allowed' },
    });
  }

  return <>{fallback}</>;
}