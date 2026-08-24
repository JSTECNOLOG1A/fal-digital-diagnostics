/**
 * RoleRoute — Runtime Route Guard (SEG-03)
 * =====================================================================
 * Route-level guard that checks role-based permissions using the ACTUAL
 * runtime user context (via usePermissions → rbac.js).
 *
 * Usage in App.jsx:
 *   <Route path="/Tenants" element={
 *     <RoleRoute requireHQ>
 *       <Tenants />
 *     </RoleRoute>
 *   } />
 *
 *   <Route path="/MethodAdmin" element={
 *     <RoleRoute requireAdmin>
 *       <MethodAdmin />
 *     </RoleRoute>
 *   } />
 *
 * When denied, redirects to the home page (or a custom denied page).
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/lib/hooks/usePermissions';

/**
 * @param {Object} props
 * @param {any} props.children
 * @param {boolean=} props.requireHQ — require hq_admin/admin role
 * @param {boolean=} props.requireAdmin — require any admin-level role
 * @param {boolean=} props.requireWrite — require write capability (excludes client_viewer)
 * @param {boolean=} props.requireRead — require read capability (includes client_viewer for read-only pages)
 * @param {string=} props.area — require permission for this area
 * @param {string=} props.redirectTo — redirect path when denied (default: '/')
 */
export default function RoleRoute({
  children,
  requireHQ = false,
  requireAdmin = false,
  requireWrite = false,
  requireRead = false,
  area,
  redirectTo = '/',
}) {
  const perms = usePermissions();

  let allowed = true;
  if (requireHQ) allowed = allowed && perms.isHQ;
  if (requireAdmin) allowed = allowed && perms.isAdmin;
  if (requireWrite) allowed = allowed && perms.canWrite;
  if (requireRead) allowed = allowed && perms.canRead;

  if (area) {
    const areaMap = {
      group: perms.canManageGroup,
      diagnosis: perms.canManageDiagnosis,
      questionnaire: perms.canManageQuestionnaire,
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

  if (!allowed) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}