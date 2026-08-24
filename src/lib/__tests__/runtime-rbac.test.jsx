/**
 * Runtime RBAC Tests — SEG-03 (Real Consumers)
 * =====================================================================
 * These tests verify the ACTUAL runtime consumers of rbac.js:
 *   - usePermissions hook (connects rbac.js to live user context)
 *   - PermissionGuard component (UI conditional rendering)
 *   - RoleRoute component (route-level gating)
 *
 * They do NOT test getPermissionMatrix() in isolation — they test the
 * components and hooks that are used in the live application, with
 * mocked TenantContext providing different user roles.
 *
 * This proves that the RBAC policy is CONNECTED to the runtime,
 * not just a theoretical matrix.
 *
 * QA-005: vi.mock calls are hoisted by Vitest BEFORE any imports.
 * This prevents the real Base44 SDK from initializing and making
 * network calls (ECONNREFUSED 127.0.0.1:3000) during the test.
 * The test provides its own TenantContext.Provider value, so the
 * real TenantProvider (which uses base44.auth.me()) is never rendered.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

// ═══ QA-005: Mock base44Client BEFORE any dependent module is imported ═══
// TenantContext.jsx imports { base44 } from '@/api/base44Client' — without
// this mock, the real SDK initializes and attempts network calls to
// localhost:3000, causing ECONNREFUSED errors in the test output.
vi.mock('@/api/base44Client', () => ({
  base44: {
    entities: new Proxy({}, { get: () => ({
      get: () => Promise.resolve(null),
      filter: () => Promise.resolve([]),
      list: () => Promise.resolve([]),
      create: () => Promise.resolve({}),
      update: () => Promise.resolve({}),
      delete: () => Promise.resolve({}),
      bulkCreate: () => Promise.resolve([]),
      bulkUpdate: () => Promise.resolve([]),
      updateMany: () => Promise.resolve({}),
      deleteMany: () => Promise.resolve({}),
      schema: () => Promise.resolve({}),
      subscribe: () => () => {},
    }) }),
    auth: {
      me: vi.fn(() => Promise.resolve(null)),
      isAuthenticated: vi.fn(() => Promise.resolve(false)),
      logout: vi.fn(),
      redirectToLogin: vi.fn(),
      updateMe: vi.fn(() => Promise.resolve({})),
    },
    functions: { invoke: vi.fn(() => Promise.resolve({ data: {}, status: 200 })) },
    analytics: { track: vi.fn() },
    agents: {},
    users: { inviteUser: vi.fn(() => Promise.resolve({})) },
  },
}));

// AuthContext.jsx imports useAuth internally — mock it to prevent
// any authentication-check network calls during test module import.
vi.mock('@/lib/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: null,
    isAuthenticated: false,
    authChecked: true,
    isLoadingAuth: false,
    isLoadingPublicSettings: false,
    authError: null,
    navigateToLogin: vi.fn(),
  })),
  AuthProvider: ({ children }) => children,
}));

import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TenantContext } from '@/components/shared/TenantContext';
import { usePermissions } from '@/lib/hooks/usePermissions';
import PermissionGuard from '@/components/shared/PermissionGuard';
import RoleRoute from '@/components/shared/RoleRoute';
import { resolveAppRole } from '@/lib/access-role';

// Clean up DOM between tests to prevent element pollution
afterEach(() => cleanup());

// ── Fixtures (REAL runtime format: role + app_role) ───────────────────────────
const USERS = {
  HQ: { id: 'u-hq', email: 'hq@test.com', role: 'admin', app_role: 'hq_admin', tenant_id: null },
  TENANT_ADMIN: { id: 'u-ta', email: 'ta@test.com', role: 'user', app_role: 'tenant_admin', tenant_id: 'tenant-a' },
  CONSULTANT: { id: 'u-co', email: 'co@test.com', role: 'user', app_role: 'consultant', tenant_id: 'tenant-a' },
  CLIENT_VIEWER: { id: 'u-cv', email: 'cv@test.com', role: 'user', app_role: 'client_viewer', tenant_id: 'tenant-a' },
  UNCLASSIFIED: { id: 'u-unc', email: 'unc@test.com', role: 'user', app_role: null, tenant_id: 'tenant-a' },
};

// ── Mock TenantContext wrapper ────────────────────────────────────────────────
function mockTenantValue(user, tenantId) {
  const appRole = resolveAppRole(user);
  const isHQ = appRole === 'hq_admin';
  return {
    user,
    tenant: { id: tenantId || user?.tenant_id },
    methodVersion: null,
    tenantId: tenantId || user?.tenant_id || null,
    activeTenantId: tenantId || null,
    loading: false,
    error: null,
    isHQ,
    isTenantAdmin: appRole === 'tenant_admin',
    isConsultant: appRole === 'consultant',
    isClient: appRole === 'client_viewer',
    isReady: true,
    setTenant: vi.fn(),
    setMethodVersion: vi.fn(),
    setActiveTenantId: vi.fn(),
  };
}

function withTenant(user, Component, props = {}) {
  const value = mockTenantValue(user, props.tenantId);
  return render(
    <TenantContext.Provider value={value}>
      <MemoryRouter>
        <Component {...props} />
      </MemoryRouter>
    </TenantContext.Provider>
  );
}

// ── Hook test component ───────────────────────────────────────────────────────
function HookProbe() {
  const perms = usePermissions();
  return (
    <div>
      <span data-testid="role">{perms.role}</span>
      <span data-testid="appRole">{perms.appRole}</span>
      <span data-testid="isHQ">{String(perms.isHQ)}</span>
      <span data-testid="isAdmin">{String(perms.isAdmin)}</span>
      <span data-testid="canWrite">{String(perms.canWrite)}</span>
      <span data-testid="canManageUsers">{String(perms.canManageUsers)}</span>
      <span data-testid="canDeleteEntity">{String(perms.canDeleteEntity)}</span>
      <span data-testid="canSwitchTenant">{String(perms.canSwitchTenant)}</span>
      <span data-testid="area-users">{perms.getAreaPermission('users')}</span>
      <span data-testid="area-actionplan">{perms.getAreaPermission('actionplan')}</span>
    </div>
  );
}

// ── Tests: usePermissions hook (runtime consumer) ─────────────────────────────
describe('SEG-03 Runtime — usePermissions hook', () => {
  it('HQ user: all permissions true', () => {
    withTenant(USERS.HQ, HookProbe);
    expect(screen.getByTestId('role').textContent).toBe('admin');
    expect(screen.getByTestId('appRole').textContent).toBe('hq_admin');
    expect(screen.getByTestId('isHQ').textContent).toBe('true');
    expect(screen.getByTestId('canWrite').textContent).toBe('true');
    expect(screen.getByTestId('canManageUsers').textContent).toBe('true');
    expect(screen.getByTestId('canDeleteEntity').textContent).toBe('true');
    expect(screen.getByTestId('canSwitchTenant').textContent).toBe('true');
  });

  it('tenant_admin: canWrite true, canSwitchTenant false', () => {
    withTenant(USERS.TENANT_ADMIN, HookProbe);
    expect(screen.getByTestId('isHQ').textContent).toBe('false');
    expect(screen.getByTestId('canWrite').textContent).toBe('true');
    expect(screen.getByTestId('canManageUsers').textContent).toBe('true');
    expect(screen.getByTestId('canSwitchTenant').textContent).toBe('false');
  });

  it('consultant: canWrite true, canManageUsers false, canDeleteEntity false', () => {
    withTenant(USERS.CONSULTANT, HookProbe);
    expect(screen.getByTestId('canWrite').textContent).toBe('true');
    expect(screen.getByTestId('canManageUsers').textContent).toBe('false');
    expect(screen.getByTestId('canDeleteEntity').textContent).toBe('false');
    expect(screen.getByTestId('canSwitchTenant').textContent).toBe('false');
  });

  it('client_viewer: canWrite false (READ-ONLY)', () => {
    withTenant(USERS.CLIENT_VIEWER, HookProbe);
    expect(screen.getByTestId('canWrite').textContent).toBe('false');
    expect(screen.getByTestId('area-actionplan').textContent).toBe('READ-ONLY');
    expect(screen.getByTestId('area-users').textContent).toBe('DENY');
  });

  it('hasTenantAccess: consultant can access own tenant, not other', () => {
    function Probe() {
      const perms = usePermissions();
      return (
        <div>
          <span data-testid="own">{String(perms.hasTenantAccess('tenant-a'))}</span>
          <span data-testid="other">{String(perms.hasTenantAccess('tenant-b'))}</span>
        </div>
      );
    }
    withTenant(USERS.CONSULTANT, Probe);
    expect(screen.getByTestId('own').textContent).toBe('true');
    expect(screen.getByTestId('other').textContent).toBe('false');
  });

  it('unclassified user (role=user, app_role=null): all permissions DENIED', () => {
    withTenant(USERS.UNCLASSIFIED, HookProbe);
    expect(screen.getByTestId('appRole').textContent).toBe('');
    expect(screen.getByTestId('isHQ').textContent).toBe('false');
    expect(screen.getByTestId('canWrite').textContent).toBe('false');
    expect(screen.getByTestId('canManageUsers').textContent).toBe('false');
    expect(screen.getByTestId('canDeleteEntity').textContent).toBe('false');
    expect(screen.getByTestId('canSwitchTenant').textContent).toBe('false');
  });
});

// ── Tests: PermissionGuard component (runtime UI guard) ───────────────────────
describe('SEG-03 Runtime — PermissionGuard component', () => {
  it('renders children when user has permission', () => {
    withTenant(USERS.CONSULTANT, PermissionGuard, {
      area: 'actionplan',
      children: <button>Delete</button>,
    });
    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it('hides children when user lacks permission (consultant → users)', () => {
    withTenant(USERS.CONSULTANT, PermissionGuard, {
      area: 'users',
      children: <button>Invite User</button>,
    });
    expect(screen.queryByText('Invite User')).toBeNull();
  });

  it('renders fallback when denied', () => {
    withTenant(USERS.CLIENT_VIEWER, PermissionGuard, {
      area: 'diagnosis',
      children: <button>Edit</button>,
      fallback: <span>Read-only</span>,
    });
    expect(screen.queryByText('Edit')).toBeNull();
    expect(screen.getByText('Read-only')).toBeTruthy();
  });

  it('requireHQ: shows for HQ, hides for tenant_admin', () => {
    const { unmount: u1 } = withTenant(USERS.HQ, PermissionGuard, {
      requireHQ: true,
      children: <button>Admin Only</button>,
    });
    expect(screen.getByText('Admin Only')).toBeTruthy();
    u1();

    withTenant(USERS.TENANT_ADMIN, PermissionGuard, {
      requireHQ: true,
      children: <button>Admin Only</button>,
    });
    expect(screen.queryByText('Admin Only')).toBeNull();
  });

  it('requireDelete: shows for admin, hides for consultant', () => {
    const { unmount: u1 } = withTenant(USERS.TENANT_ADMIN, PermissionGuard, {
      requireDelete: true,
      children: <button>Purge</button>,
    });
    expect(screen.getByText('Purge')).toBeTruthy();
    u1();

    withTenant(USERS.CONSULTANT, PermissionGuard, {
      requireDelete: true,
      children: <button>Purge</button>,
    });
    expect(screen.queryByText('Purge')).toBeNull();
  });

  it('client_viewer denied on all write areas', () => {
    const areas = ['group', 'diagnosis', 'questionnaire', 'consolidation', 'actionplan', 'reviews', 'reports'];
    for (const area of areas) {
      const { unmount } = withTenant(USERS.CLIENT_VIEWER, PermissionGuard, {
        area,
        children: <button>{area}</button>,
      });
      expect(screen.queryByText(area)).toBeNull();
      unmount();
    }
  });
});

// ── Tests: RoleRoute component (runtime route guard) ──────────────────────────
describe('SEG-03 Runtime — RoleRoute component', () => {
  it('allows access when role is sufficient', () => {
    withTenant(USERS.HQ, RoleRoute, {
      requireHQ: true,
      children: <div>Admin Page</div>,
    });
    expect(screen.getByText('Admin Page')).toBeTruthy();
  });

  it('redirects when role is insufficient', () => {
    withTenant(USERS.CONSULTANT, RoleRoute, {
      requireHQ: true,
      children: <div>Admin Page</div>,
    });
    // Should not render the page content (redirects to /)
    expect(screen.queryByText('Admin Page')).toBeNull();
  });

  it('requireAdmin: allows tenant_admin, denies consultant', () => {
    const { unmount: u1 } = withTenant(USERS.TENANT_ADMIN, RoleRoute, {
      requireAdmin: true,
      children: <div>Admin Area</div>,
    });
    expect(screen.getByText('Admin Area')).toBeTruthy();
    u1();

    withTenant(USERS.CONSULTANT, RoleRoute, {
      requireAdmin: true,
      children: <div>Admin Area</div>,
    });
    expect(screen.queryByText('Admin Area')).toBeNull();
  });

  // ── SEG-03: requireRead — allows client_viewer for read-only pages ──
  it('requireRead: allows client_viewer (read-only access)', () => {
    withTenant(USERS.CLIENT_VIEWER, RoleRoute, {
      requireRead: true,
      children: <div>Read Only Page</div>,
    });
    expect(screen.getByText('Read Only Page')).toBeTruthy();
  });

  it('requireRead: allows consultant', () => {
    withTenant(USERS.CONSULTANT, RoleRoute, {
      requireRead: true,
      children: <div>Read Only Page</div>,
    });
    expect(screen.getByText('Read Only Page')).toBeTruthy();
  });

  it('requireRead: allows HQ admin', () => {
    withTenant(USERS.HQ, RoleRoute, {
      requireRead: true,
      children: <div>Read Only Page</div>,
    });
    expect(screen.getByText('Read Only Page')).toBeTruthy();
  });

  it('requireRead + requireWrite: denies client_viewer (write not allowed)', () => {
    withTenant(USERS.CLIENT_VIEWER, RoleRoute, {
      requireRead: true,
      requireWrite: true,
      children: <div>Write Page</div>,
    });
    // requireWrite overrides — client_viewer cannot write
    expect(screen.queryByText('Write Page')).toBeNull();
  });

  it('requireRead + requireWrite: allows consultant (read+write)', () => {
    withTenant(USERS.CONSULTANT, RoleRoute, {
      requireRead: true,
      requireWrite: true,
      children: <div>Write Page</div>,
    });
    expect(screen.getByText('Write Page')).toBeTruthy();
  });
});