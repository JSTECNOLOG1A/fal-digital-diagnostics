/**
 * RBAC Test Suite — SEG-03
 * =====================================================================
 * Tests the central authorization module that encodes the four-role
 * permission matrix. These are the SAME functions used in runtime guards.
 *
 * FIXTURE FORMAT: Tests use the REAL runtime user format:
 *   { role: 'admin'|'user', app_role: 'hq_admin'|'tenant_admin'|'consultant'|'client_viewer'|null, tenant_id }
 *
 * This reflects the actual contract:
 *   built-in role 'admin' + app_role 'hq_admin'  → hq_admin
 *   built-in role 'user'  + app_role 'tenant_admin'  → tenant_admin
 *   built-in role 'user'  + app_role 'consultant'    → consultant
 *   built-in role 'user'  + app_role 'client_viewer' → client_viewer
 *   built-in role 'user'  + app_role null            → DENY (deny-by-default)
 *   built-in role 'admin' + app_role null            → hq_admin (legacy compat)
 */
import { describe, it, expect } from 'vitest';
import {
  ROLES,
  isHQ,
  isAdmin,
  canWrite,
  canRead,
  canDelete,
  assertTenantAccess,
  hasTenantAccess,
  canManageGroup,
  canManageDiagnosis,
  canManageQuestionnaire,
  canManageConsolidation,
  canManageActionPlan,
  canManageReviews,
  canManageReports,
  canManageUsers,
  canDeleteEntity,
  canSwitchTenant,
  canAccessClientPortal,
  getPermissionMatrix,
} from '@/lib/rbac';

// ── Fixtures (REAL runtime format) ─────────────────────────────────────────────
const HQ = { role: 'admin', app_role: 'hq_admin', tenant_id: null };
const TENANT_ADMIN = { role: 'user', app_role: 'tenant_admin', tenant_id: 'tenant-a' };
const CONSULTANT = { role: 'user', app_role: 'consultant', tenant_id: 'tenant-a' };
const CLIENT_VIEWER = { role: 'user', app_role: 'client_viewer', tenant_id: 'tenant-a' };
const UNCLASSIFIED = { role: 'user', app_role: null, tenant_id: 'tenant-a' }; // → DENY
const LEGACY_ADMIN = { role: 'admin', app_role: null, tenant_id: null }; // → hq_admin via compat
const ANON = { role: 'unknown', app_role: null, tenant_id: 'tenant-a' }; // → null → DENY

// ── Role predicates ───────────────────────────────────────────────────────────
describe('RBAC — Role Predicates (resolveAppRole contract)', () => {
  it('isHQ returns true for hq_admin (admin + app_role=hq_admin)', () => {
    expect(isHQ(HQ)).toBe(true);
  });

  it('isHQ returns true for legacy admin (admin + app_role=null)', () => {
    expect(isHQ(LEGACY_ADMIN)).toBe(true);
  });

  it('isHQ returns false for tenant_admin, consultant, client_viewer', () => {
    expect(isHQ(TENANT_ADMIN)).toBe(false);
    expect(isHQ(CONSULTANT)).toBe(false);
    expect(isHQ(CLIENT_VIEWER)).toBe(false);
  });

  it('isHQ returns false for unclassified user and null', () => {
    expect(isHQ(UNCLASSIFIED)).toBe(false);
    expect(isHQ(null)).toBe(false);
  });

  it('isAdmin returns true for hq_admin and tenant_admin', () => {
    expect(isAdmin(HQ)).toBe(true);
    expect(isAdmin(LEGACY_ADMIN)).toBe(true);
    expect(isAdmin(TENANT_ADMIN)).toBe(true);
  });

  it('isAdmin returns false for consultant, client_viewer, unclassified', () => {
    expect(isAdmin(CONSULTANT)).toBe(false);
    expect(isAdmin(CLIENT_VIEWER)).toBe(false);
    expect(isAdmin(UNCLASSIFIED)).toBe(false);
  });

  it('canWrite returns true for hq_admin, tenant_admin, consultant', () => {
    expect(canWrite(HQ)).toBe(true);
    expect(canWrite(TENANT_ADMIN)).toBe(true);
    expect(canWrite(CONSULTANT)).toBe(true);
  });

  it('canWrite returns false for client_viewer and unclassified', () => {
    expect(canWrite(CLIENT_VIEWER)).toBe(false);
    expect(canWrite(UNCLASSIFIED)).toBe(false);
  });

  it('canRead returns true for all classified roles including client_viewer', () => {
    expect(canRead(HQ)).toBe(true);
    expect(canRead(TENANT_ADMIN)).toBe(true);
    expect(canRead(CONSULTANT)).toBe(true);
    expect(canRead(CLIENT_VIEWER)).toBe(true);
    expect(canRead(LEGACY_ADMIN)).toBe(true);
  });

  it('canRead returns false for unclassified user and unknown role', () => {
    expect(canRead(UNCLASSIFIED)).toBe(false);
    expect(canRead(ANON)).toBe(false);
  });

  it('canDelete returns true for hq_admin and tenant_admin only', () => {
    expect(canDelete(HQ)).toBe(true);
    expect(canDelete(TENANT_ADMIN)).toBe(true);
  });

  it('canDelete returns false for consultant, client_viewer, unclassified', () => {
    expect(canDelete(CONSULTANT)).toBe(false);
    expect(canDelete(CLIENT_VIEWER)).toBe(false);
    expect(canDelete(UNCLASSIFIED)).toBe(false);
  });
});

// ── Deny-by-default for unclassified users ──────────────────────────────────────
describe('RBAC — Deny-by-default for unclassified users (role=user, app_role=null)', () => {
  it('unclassified user has NO operational access', () => {
    expect(canRead(UNCLASSIFIED)).toBe(false);
    expect(canWrite(UNCLASSIFIED)).toBe(false);
    expect(canDelete(UNCLASSIFIED)).toBe(false);
    expect(isHQ(UNCLASSIFIED)).toBe(false);
    expect(isAdmin(UNCLASSIFIED)).toBe(false);
  });

  it('unclassified user gets empty permission matrix', () => {
    const m = getPermissionMatrix(UNCLASSIFIED);
    expect(Object.keys(m).length).toBe(0);
  });

  it('unclassified user cannot access any tenant', () => {
    expect(() => assertTenantAccess(UNCLASSIFIED, 'tenant-a')).toThrow();
    expect(hasTenantAccess(UNCLASSIFIED, 'tenant-a')).toBe(false);
  });
});

// ── Legacy admin compatibility ──────────────────────────────────────────────────
describe('RBAC — Legacy admin compatibility (role=admin, app_role=null → hq_admin)', () => {
  it('legacy admin is treated as hq_admin', () => {
    expect(isHQ(LEGACY_ADMIN)).toBe(true);
    expect(canWrite(LEGACY_ADMIN)).toBe(true);
    expect(canRead(LEGACY_ADMIN)).toBe(true);
    expect(canDelete(LEGACY_ADMIN)).toBe(true);
    expect(canSwitchTenant(LEGACY_ADMIN)).toBe(true);
  });

  it('legacy admin gets full ALLOW matrix', () => {
    const m = getPermissionMatrix(LEGACY_ADMIN);
    expect(m.group).toBe('ALLOW');
    expect(m.tenant_switch).toBe('ALLOW');
  });
});

// ── Tenant access ─────────────────────────────────────────────────────────────
describe('RBAC — Tenant Access (deny-by-default)', () => {
  it('HQ admin can access any tenant', () => {
    expect(() => assertTenantAccess(HQ, 'tenant-b')).not.toThrow();
    expect(hasTenantAccess(HQ, 'any-tenant')).toBe(true);
  });

  it('tenant_admin can access own tenant', () => {
    expect(() => assertTenantAccess(TENANT_ADMIN, 'tenant-a')).not.toThrow();
    expect(hasTenantAccess(TENANT_ADMIN, 'tenant-a')).toBe(true);
  });

  it('tenant_admin CANNOT access other tenant', () => {
    expect(() => assertTenantAccess(TENANT_ADMIN, 'tenant-b')).toThrow();
    expect(hasTenantAccess(TENANT_ADMIN, 'tenant-b')).toBe(false);
  });

  it('consultant can access own tenant', () => {
    expect(() => assertTenantAccess(CONSULTANT, 'tenant-a')).not.toThrow();
  });

  it('consultant CANNOT access other tenant', () => {
    expect(() => assertTenantAccess(CONSULTANT, 'tenant-b')).toThrow();
  });

  it('client_viewer can access own tenant', () => {
    expect(() => assertTenantAccess(CLIENT_VIEWER, 'tenant-a')).not.toThrow();
  });

  it('client_viewer CANNOT access other tenant', () => {
    expect(() => assertTenantAccess(CLIENT_VIEWER, 'tenant-b')).toThrow();
  });

  it('unclassified user is DENIED tenant access (no implicit bypass)', () => {
    expect(() => assertTenantAccess(UNCLASSIFIED, 'tenant-a')).toThrow();
    expect(hasTenantAccess(UNCLASSIFIED, 'tenant-a')).toBe(false);
  });

  it('user without tenant_id is DENIED', () => {
    const noTenant = { role: 'user', app_role: 'consultant', tenant_id: undefined };
    expect(() => assertTenantAccess(noTenant, 'tenant-a')).toThrow();
  });
});

// ── Resource permissions ──────────────────────────────────────────────────────
describe('RBAC — Resource Permissions', () => {
  it('hq_admin can manage everything and switch tenants', () => {
    expect(canManageGroup(HQ)).toBe(true);
    expect(canManageDiagnosis(HQ)).toBe(true);
    expect(canManageQuestionnaire(HQ)).toBe(true);
    expect(canManageConsolidation(HQ)).toBe(true);
    expect(canManageActionPlan(HQ)).toBe(true);
    expect(canManageReviews(HQ)).toBe(true);
    expect(canManageReports(HQ)).toBe(true);
    expect(canManageUsers(HQ)).toBe(true);
    expect(canDeleteEntity(HQ)).toBe(true);
    expect(canSwitchTenant(HQ)).toBe(true);
  });

  it('tenant_admin can manage operational data but NOT switch tenants', () => {
    expect(canManageGroup(TENANT_ADMIN)).toBe(true);
    expect(canManageDiagnosis(TENANT_ADMIN)).toBe(true);
    expect(canManageActionPlan(TENANT_ADMIN)).toBe(true);
    expect(canManageUsers(TENANT_ADMIN)).toBe(true);
    expect(canDeleteEntity(TENANT_ADMIN)).toBe(true);
    expect(canSwitchTenant(TENANT_ADMIN)).toBe(false);
  });

  it('consultant can manage operational data but NOT users/exclusions/tenant switch', () => {
    expect(canManageGroup(CONSULTANT)).toBe(true);
    expect(canManageDiagnosis(CONSULTANT)).toBe(true);
    expect(canManageActionPlan(CONSULTANT)).toBe(true);
    expect(canManageUsers(CONSULTANT)).toBe(false);
    expect(canDeleteEntity(CONSULTANT)).toBe(false);
    expect(canSwitchTenant(CONSULTANT)).toBe(false);
  });

  it('client_viewer is READ-ONLY — cannot manage anything', () => {
    expect(canManageGroup(CLIENT_VIEWER)).toBe(false);
    expect(canManageDiagnosis(CLIENT_VIEWER)).toBe(false);
    expect(canManageQuestionnaire(CLIENT_VIEWER)).toBe(false);
    expect(canManageConsolidation(CLIENT_VIEWER)).toBe(false);
    expect(canManageActionPlan(CLIENT_VIEWER)).toBe(false);
    expect(canManageReviews(CLIENT_VIEWER)).toBe(false);
    expect(canManageReports(CLIENT_VIEWER)).toBe(false);
    expect(canManageUsers(CLIENT_VIEWER)).toBe(false);
    expect(canDeleteEntity(CLIENT_VIEWER)).toBe(false);
    expect(canSwitchTenant(CLIENT_VIEWER)).toBe(false);
  });

  it('unclassified user cannot manage anything', () => {
    expect(canManageGroup(UNCLASSIFIED)).toBe(false);
    expect(canManageDiagnosis(UNCLASSIFIED)).toBe(false);
    expect(canManageActionPlan(UNCLASSIFIED)).toBe(false);
    expect(canManageUsers(UNCLASSIFIED)).toBe(false);
    expect(canDeleteEntity(UNCLASSIFIED)).toBe(false);
  });

  it('client_viewer CAN access client portal', () => {
    expect(canAccessClientPortal(CLIENT_VIEWER)).toBe(true);
  });

  it('consultant CAN access client portal', () => {
    expect(canAccessClientPortal(CONSULTANT)).toBe(true);
  });

  it('unclassified user CANNOT access client portal', () => {
    expect(canAccessClientPortal(UNCLASSIFIED)).toBe(false);
  });
});

// ── Permission Matrix ─────────────────────────────────────────────────────────
describe('RBAC — Full Permission Matrix', () => {
  const AREAS = [
    'group', 'company', 'unit', 'diagnosis', 'questionnaire',
    'financial', 'consolidation', 'actionplan', 'reviews',
    'reports', 'users', 'exclusions', 'tenant_switch',
  ];

  it('hq_admin matrix: ALLOW on all areas', () => {
    const m = getPermissionMatrix(HQ);
    for (const area of AREAS) {
      expect(m[area]).toBe('ALLOW');
    }
  });

  it('tenant_admin matrix: ALLOW operational, ALLOW users/exclusions, DENY tenant_switch', () => {
    const m = getPermissionMatrix(TENANT_ADMIN);
    expect(m.group).toBe('ALLOW');
    expect(m.diagnosis).toBe('ALLOW');
    expect(m.actionplan).toBe('ALLOW');
    expect(m.users).toBe('ALLOW');
    expect(m.exclusions).toBe('ALLOW');
    expect(m.tenant_switch).toBe('DENY');
  });

  it('consultant matrix: ALLOW operational, DENY users/exclusions/tenant_switch', () => {
    const m = getPermissionMatrix(CONSULTANT);
    expect(m.group).toBe('ALLOW');
    expect(m.diagnosis).toBe('ALLOW');
    expect(m.actionplan).toBe('ALLOW');
    expect(m.reports).toBe('ALLOW');
    expect(m.users).toBe('DENY');
    expect(m.exclusions).toBe('DENY');
    expect(m.tenant_switch).toBe('DENY');
  });

  it('client_viewer matrix: READ-ONLY on operational, DENY on admin/exclusions/switch', () => {
    const m = getPermissionMatrix(CLIENT_VIEWER);
    expect(m.group).toBe('READ-ONLY');
    expect(m.company).toBe('READ-ONLY');
    expect(m.diagnosis).toBe('READ-ONLY');
    expect(m.financial).toBe('READ-ONLY');
    expect(m.actionplan).toBe('READ-ONLY');
    expect(m.reports).toBe('READ-ONLY');
    expect(m.users).toBe('DENY');
    expect(m.exclusions).toBe('DENY');
    expect(m.tenant_switch).toBe('DENY');
  });

  it('unclassified user returns empty matrix (deny-by-default)', () => {
    const m = getPermissionMatrix(UNCLASSIFIED);
    expect(Object.keys(m).length).toBe(0);
  });

  it('legacy admin returns full ALLOW matrix', () => {
    const m = getPermissionMatrix(LEGACY_ADMIN);
    expect(m.group).toBe('ALLOW');
    expect(m.tenant_switch).toBe('ALLOW');
  });
});