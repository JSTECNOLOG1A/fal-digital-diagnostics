/**
 * access-role — Canonical App Role Resolver
 * =====================================================================
 * Single source of truth for mapping Base44 built-in roles to FAL
 * operational roles.
 *
 * Base44 built-in `role` field:  'admin' | 'user'
 * FAL custom `app_role` field:  'hq_admin' | 'tenant_admin' | 'consultant' | 'client_viewer'
 *
 * Contract:
 *   admin  → hq_admin      (global)
 *   user   → tenant_admin  (tenant)         — ONLY if app_role is set
 *   user   → consultant    (tenant)         — ONLY if app_role is set
 *   user   → client_viewer (tenant/read-only) — ONLY if app_role is set
 *   user with app_role=null → DENY (no operational access)
 *
 * CRITICAL: role='user' is NEVER auto-mapped to 'consultant'.
 *   Auto-mapping would grant write access to any unclassified user.
 */
export const APP_ROLES = new Set([
  'hq_admin',
  'tenant_admin',
  'consultant',
  'client_viewer',
]);

/**
 * Resolves the FAL operational role from a user object.
 *
 * @param {{ app_role?: string, role?: string, access_status?: string } | null} user
 * @returns {string | null} — 'hq_admin' | 'tenant_admin' | 'consultant' | 'client_viewer' | null
 */
export function resolveAppRole(user) {
  if (!user || user.access_status === 'revoked') return null;

  // app_role is the canonical source — if set and valid, it wins
  if (APP_ROLES.has(user.app_role)) {
    return user.app_role;
  }

  // Temporary compatibility: built-in 'admin' maps to 'hq_admin'
  // This is the ONLY auto-mapping. 'user' is NEVER auto-mapped.
  if (user.role === 'admin') {
    return 'hq_admin';
  }

  // Built-in 'user' without app_role = deny-by-default
  return null;
}