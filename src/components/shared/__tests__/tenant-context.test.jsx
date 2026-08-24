import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import React from 'react';

// ── Hoisted mock objects ───────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  tenantGet: vi.fn(),
  methodVersionGet: vi.fn(),
  methodVersionFilter: vi.fn(),
}));

vi.mock('@/lib/AuthContext', () => ({
  useAuth: mocks.useAuth,
  AuthProvider: ({ children }) => children,
}));

vi.mock('@/api/base44Client', () => ({
  base44: {
    entities: {
      Tenant: { get: mocks.tenantGet },
      MethodVersion: { get: mocks.methodVersionGet, filter: mocks.methodVersionFilter },
    },
  },
}));

import { TenantProvider, useTenant } from '@/components/shared/TenantContext';

// ── Consumer component ─────────────────────────────────────────────────────────
function TenantConsumer({ onState }) {
  const ctx = useTenant();
  React.useEffect(() => { onState(ctx); }, [ctx]);
  return null;
}

const HQ_USER      = { id: 'u1', role: 'admin', app_role: 'hq_admin', tenant_id: 't1' };
const TENANT_A     = { id: 't1', name: 'Tenant A', active_method_version_id: 'mv1' };
const TENANT_B     = { id: 't2', name: 'Tenant B', active_method_version_id: 'mv2' };
const MV1          = { id: 'mv1', version: '1.0' };
const MV2          = { id: 'mv2', version: '2.0' };

const LS_KEY = 'fal_active_tenant_id';

describe('TenantContext — behavioral tests', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.useAuth.mockReturnValue({
      user: HQ_USER,
      isAuthenticated: true,
      authChecked: true,
      isLoadingAuth: false,
    });
    mocks.tenantGet.mockImplementation((id) => {
      if (id === 't1') return Promise.resolve(TENANT_A);
      if (id === 't2') return Promise.resolve(TENANT_B);
      return Promise.reject(new Error('Not found'));
    });
    mocks.methodVersionGet.mockImplementation((id) => {
      if (id === 'mv1') return Promise.resolve(MV1);
      if (id === 'mv2') return Promise.resolve(MV2);
      return Promise.reject(new Error('Not found'));
    });
    mocks.methodVersionFilter.mockResolvedValue([]);
  });

  // ── Scenario A — HQ Admin loads own tenant; no divergence ─────────────────────
  it('Scenario A — HQ Admin: tenantId === tenant.id, MethodVersion loaded', async () => {
    let state = null;
    render(
      <TenantProvider>
        <TenantConsumer onState={(s) => { state = s; }} />
      </TenantProvider>
    );

    await waitFor(() => expect(state?.loading).toBe(false));

    expect(state.tenantId).toBe('t1');
    expect(state.tenant?.id).toBe('t1');
    expect(state.tenant?.id).toBe(state.tenantId); // ★ critical: no divergence
    expect(state.methodVersion?.id).toBe('mv1');
    expect(state.isHQ).toBe(true);
  });

  // ── Scenario B — non-HQ ignores fake localStorage tenant ──────────────────────
  it('Scenario B — non-HQ: fake localStorage tenant ignored, user tenant used', async () => {
    const nonHqUser = { id: 'u2', role: 'user', app_role: 'consultant', tenant_id: 't1' };
    mocks.useAuth.mockReturnValue({
      user: nonHqUser,
      isAuthenticated: true,
      authChecked: true,
      isLoadingAuth: false,
    });

    // Inject fake tenant B in localStorage
    localStorage.setItem(LS_KEY, 't2');

    let state = null;
    render(
      <TenantProvider>
        <TenantConsumer onState={(s) => { state = s; }} />
      </TenantProvider>
    );

    await waitFor(() => expect(state?.loading).toBe(false));

    expect(state.tenantId).toBe('t1');  // uses user's tenant, not localStorage
    expect(state.tenant?.id).toBe('t1');
    expect(state.isHQ).toBe(false);
    // Tenant B was never fetched
    expect(mocks.tenantGet).not.toHaveBeenCalledWith('t2');
  });

  // ── Scenario C — tenant not found ─────────────────────────────────────────────
  it('Scenario C — tenant not found: error handled, no partial context, no loop', async () => {
    mocks.useAuth.mockReturnValue({
      user: { id: 'u3', role: 'admin', app_role: 'hq_admin', tenant_id: 'bad-id' },
      isAuthenticated: true,
      authChecked: true,
      isLoadingAuth: false,
    });
    mocks.tenantGet.mockRejectedValue(new Error('Not found'));

    let state = null;
    const { unmount } = render(
      <TenantProvider>
        <TenantConsumer onState={(s) => { state = s; }} />
      </TenantProvider>
    );

    await waitFor(() => expect(state?.loading).toBe(false));

    // No stale tenant object retained
    expect(state.tenant).toBeNull();
    expect(state.loading).toBe(false);
    // Tenant.get called once (no infinite retry loop)
    expect(mocks.tenantGet).toHaveBeenCalledTimes(1);

    unmount(); // clean unmount, no hanging promises
  });

  // ── Scenario D — logout resets context ────────────────────────────────────────
  it('Scenario D — logout: tenant and methodVersion reset to null', async () => {
    let state = null;
    const { rerender } = render(
      <TenantProvider>
        <TenantConsumer onState={(s) => { state = s; }} />
      </TenantProvider>
    );

    await waitFor(() => expect(state?.loading).toBe(false));
    expect(state.tenant?.id).toBe('t1');
    expect(state.methodVersion?.id).toBe('mv1');

    // Simulate logout: auth state changes to user=null
    mocks.useAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      authChecked: true,
      isLoadingAuth: false,
    });

    rerender(
      <TenantProvider>
        <TenantConsumer onState={(s) => { state = s; }} />
      </TenantProvider>
    );

    await waitFor(() => {
      expect(state.tenant).toBeNull();
      expect(state.methodVersion).toBeNull();
    });
  });

  // ── HQ tenant switch via setActiveTenantId ────────────────────────────────────
  it('HQ switch A→B: setActiveTenantId updates state, tenant.id matches new tenantId', async () => {
    let state = null;
    render(
      <TenantProvider>
        <TenantConsumer onState={(s) => { state = s; }} />
      </TenantProvider>
    );

    // Initial load: Tenant A
    await waitFor(() => expect(state?.tenant?.id).toBe('t1'));

    // Call setActiveTenantId('t2') — sets localStorage, clears cache, updates state
    // window.location.href is mocked to no-op in setup
    let switchResult;
    await act(async () => {
      switchResult = await state.setActiveTenantId('t2');
    });

    expect(switchResult.ok).toBe(true);
    expect(localStorage.getItem(LS_KEY)).toBe('t2');

    // The state change triggers useEffect re-run with new activeTenantId
    await waitFor(() => {
      expect(state.tenantId).toBe('t2');
      expect(state.tenant?.id).toBe('t2');
      expect(state.tenant?.id).toBe(state.tenantId); // ★ no divergence after switch
    });
  });

  // ── Non-HQ cannot switch tenant ───────────────────────────────────────────────
  it('Non-HQ setActiveTenantId rejected with TENANT_SWITCH_NOT_ALLOWED', async () => {
    const nonHqUser = { id: 'u2', role: 'user', app_role: 'consultant', tenant_id: 't1' };
    mocks.useAuth.mockReturnValue({
      user: nonHqUser,
      isAuthenticated: true,
      authChecked: true,
      isLoadingAuth: false,
    });

    let state = null;
    render(
      <TenantProvider>
        <TenantConsumer onState={(s) => { state = s; }} />
      </TenantProvider>
    );

    await waitFor(() => expect(state?.loading).toBe(false));

    let switchResult;
    await act(async () => {
      switchResult = await state.setActiveTenantId('t2');
    });

    expect(switchResult.ok).toBe(false);
    expect(switchResult.reason).toBe('TENANT_SWITCH_NOT_ALLOWED');
    expect(localStorage.getItem(LS_KEY)).toBeNull();
    expect(mocks.tenantGet).not.toHaveBeenCalledWith('t2');
  });
});