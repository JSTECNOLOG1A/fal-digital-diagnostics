import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import React from 'react';

// ── Hoisted mock objects (vitest hoists vi.mock above imports) ─────────────────
const mocks = vi.hoisted(() => ({
  auth: {
    me: vi.fn(),
    logout: vi.fn(),
    redirectToLogin: vi.fn(),
  },
  functions: {
    invoke: vi.fn(),
  },
  axiosGet: vi.fn(),
  createAxiosClient: vi.fn(),
  appParams: {
    appId: 'test-app',
    token: 'test-token',
    functionsVersion: 'v1',
    appBaseUrl: 'http://localhost',
  },
}));

vi.mock('@/api/base44Client', () => ({
  base44: { auth: mocks.auth, functions: mocks.functions },
}));

vi.mock('@base44/sdk/dist/utils/axios-client', () => ({
  createAxiosClient: mocks.createAxiosClient,
}));

vi.mock('@/lib/app-params', () => ({
  appParams: mocks.appParams,
}));

vi.mock('@/lib/query-client', () => ({
  queryClientInstance: { clear: vi.fn() },
}));

import { AuthProvider, useAuth } from '@/lib/AuthContext';

// ── Consumer component that exposes context state to the test ──────────────────
function AuthConsumer({ onState }) {
  const auth = useAuth();
  React.useEffect(() => { onState(auth); }, [auth]);
  return null;
}

describe('AuthContext — behavioral tests', () => {
  beforeEach(() => {
    // Default: public-settings fetch resolves, auth.me resolves null
    mocks.axiosGet.mockResolvedValue({ id: 'app-1', public_settings: {} });
    mocks.createAxiosClient.mockReturnValue({ get: mocks.axiosGet });
    mocks.auth.me.mockReset();
    mocks.auth.me.mockResolvedValue(null);
    mocks.auth.logout.mockImplementation(() => {});
    mocks.auth.redirectToLogin.mockImplementation(() => {});
    mocks.functions.invoke.mockReset();
    mocks.functions.invoke.mockResolvedValue({ data: { success: false } });
  });

  // ── Scenario A — authenticated user with app_role ─────────────────────────────
  it('Scenario A — authenticated user with app_role: no pending invoke, context authenticated', async () => {
    const mockUser = { id: 'u1', email: 'a@b.com', role: 'user', app_role: 'consultant', tenant_id: 't1' };
    mocks.auth.me.mockResolvedValue(mockUser);

    let state = null;
    render(
      <AuthProvider>
        <AuthConsumer onState={(s) => { state = s; }} />
      </AuthProvider>
    );

    await waitFor(() => expect(state?.authChecked).toBe(true));

    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(mockUser);
    expect(state.isLoadingAuth).toBe(false);
    expect(state.authError).toBeNull();
    expect(mocks.auth.me).toHaveBeenCalledTimes(1);
    expect(mocks.functions.invoke).not.toHaveBeenCalled();
  });

  // ── Scenario B — unauthenticated user ─────────────────────────────────────────
  it('Scenario B — unauthenticated: isAuthenticated=false, user=null, no sensitive query', async () => {
    mocks.auth.me.mockResolvedValue(null);

    let state = null;
    render(
      <AuthProvider>
        <AuthConsumer onState={(s) => { state = s; }} />
      </AuthProvider>
    );

    await waitFor(() => expect(state?.authChecked).toBe(true));

    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.isLoadingAuth).toBe(false);
    expect(mocks.auth.me).toHaveBeenCalledTimes(1);
    expect(mocks.functions.invoke).not.toHaveBeenCalled();
  });

  // ── Scenario C — error in session check ───────────────────────────────────────
  it('Scenario C — error: authError set, loading ended, no infinite loop', async () => {
    mocks.axiosGet.mockRejectedValue({
      status: 403,
      data: { extra_data: { reason: 'auth_required' } },
      message: 'Authentication required',
    });

    let state = null;
    render(
      <AuthProvider>
        <AuthConsumer onState={(s) => { state = s; }} />
      </AuthProvider>
    );

    await waitFor(() => expect(state?.authChecked).toBe(true));

    expect(state.authError).toBeTruthy();
    expect(state.authError.type).toBe('auth_required');
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoadingAuth).toBe(false);
    expect(mocks.auth.me).toHaveBeenCalledTimes(1);
  });

  // ── Scenario D — logout clears state ──────────────────────────────────────────
  it('Scenario D — logout: user removed, isAuthenticated=false, SDK logout called', async () => {
    const mockUser = { id: 'u1', email: 'a@b.com', role: 'user', app_role: 'consultant', tenant_id: 't1' };
    mocks.auth.me.mockResolvedValue(mockUser);

    let state = null;
    render(
      <AuthProvider>
        <AuthConsumer onState={(s) => { state = s; }} />
      </AuthProvider>
    );

    await waitFor(() => expect(state?.isAuthenticated).toBe(true));

    await act(async () => {
      await state.logout(false);
    });

    await waitFor(() => {
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });

    expect(mocks.auth.logout).toHaveBeenCalledTimes(1);
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // ONBOARDING SCENARIOS — applyPendingUserAccessProfile integration
  // Tests render the REAL AuthProvider (no replicated logic).
  // ═════════════════════════════════════════════════════════════════════════════

  // ── Scenario 1 — first login, app_role null → apply success → consultant ──────
  it('Scenario 1 — first auth.me → app_role null → apply pending → success → second auth.me → consultant', async () => {
    const firstUser = { id: 'u1', email: 'test@test.com', role: 'user', app_role: null, tenant_id: null };
    const secondUser = { id: 'u1', email: 'test@test.com', role: 'user', app_role: 'consultant', tenant_id: 'tenant-a' };

    mocks.auth.me
      .mockResolvedValueOnce(firstUser)
      .mockResolvedValueOnce(secondUser);

    mocks.functions.invoke.mockResolvedValue({
      data: { success: true, applied: { app_role: 'consultant', tenant_id: 'tenant-a' } },
    });

    let state = null;
    render(
      <AuthProvider>
        <AuthConsumer onState={(s) => { state = s; }} />
      </AuthProvider>
    );

    await waitFor(() => expect(state?.authChecked).toBe(true));

    expect(mocks.functions.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.functions.invoke).toHaveBeenCalledWith('applyPendingUserAccessProfile', {});
    expect(mocks.auth.me).toHaveBeenCalledTimes(2);
    expect(state.isAuthenticated).toBe(true);
    expect(state.user.app_role).toBe('consultant');
    expect(state.user.tenant_id).toBe('tenant-a');
    expect(state.authError).toBeNull();
  });

  // ── Scenario 2 — app_role already exists → invoke not called ──────────────────
  it('Scenario 2 — app_role already exists → invoke NOT called → auth.me called once', async () => {
    const mockUser = { id: 'u1', email: 'test@test.com', role: 'user', app_role: 'tenant_admin', tenant_id: 'tenant-a' };
    mocks.auth.me.mockResolvedValue(mockUser);

    let state = null;
    render(
      <AuthProvider>
        <AuthConsumer onState={(s) => { state = s; }} />
      </AuthProvider>
    );

    await waitFor(() => expect(state?.authChecked).toBe(true));

    expect(mocks.functions.invoke).not.toHaveBeenCalled();
    expect(mocks.auth.me).toHaveBeenCalledTimes(1);
    expect(state.isAuthenticated).toBe(true);
    expect(state.user.app_role).toBe('tenant_admin');
  });

  // ── Scenario 3 — apply returns 404 → user stays as-is (deny-by-default) ───────
  it('Scenario 3 — apply returns 404 → user stays authenticated without app_role, deny-by-default preserved', async () => {
    const firstUser = { id: 'u1', email: 'test@test.com', role: 'user', app_role: null, tenant_id: null };
    mocks.auth.me.mockResolvedValue(firstUser);

    mocks.functions.invoke.mockRejectedValue({
      response: { status: 404, data: { message: 'Nenhum perfil pendente encontrado' } },
      status: 404,
    });

    let state = null;
    render(
      <AuthProvider>
        <AuthConsumer onState={(s) => { state = s; }} />
      </AuthProvider>
    );

    await waitFor(() => expect(state?.authChecked).toBe(true));

    expect(mocks.functions.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.auth.me).toHaveBeenCalledTimes(1); // no re-read since 404
    expect(state.isAuthenticated).toBe(true);
    expect(state.user.app_role).toBeNull(); // unchanged — deny-by-default
    expect(state.authError).toBeNull(); // 404 is not an error
  });

  // ── Scenario 4 — apply returns 409 → onboarding error, not authenticated ──────
  it('Scenario 4 — apply returns 409 → isAuthenticated=false, authError.type=onboarding_error', async () => {
    const firstUser = { id: 'u1', email: 'test@test.com', role: 'user', app_role: null, tenant_id: null };
    mocks.auth.me.mockResolvedValue(firstUser);

    mocks.functions.invoke.mockRejectedValue({
      response: {
        status: 409,
        data: {
          error: 'Built-in role incompatível',
          code: 'BUILT_IN_ROLE_MISMATCH',
        },
      },
      status: 409,
    });

    let state = null;
    render(
      <AuthProvider>
        <AuthConsumer onState={(s) => { state = s; }} />
      </AuthProvider>
    );

    await waitFor(() => expect(state?.authChecked).toBe(true));

    expect(mocks.functions.invoke).toHaveBeenCalledTimes(1);
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.authError).toBeTruthy();
    expect(state.authError.type).toBe('onboarding_error');
    expect(state.authError.code).toBe('BUILT_IN_ROLE_MISMATCH');
  });

  // ── Scenario 5 — apply returns 500 → onboarding error, not authenticated ──────
  it('Scenario 5 — apply returns 500 → isAuthenticated=false, authError.type=onboarding_error', async () => {
    const firstUser = { id: 'u1', email: 'test@test.com', role: 'user', app_role: null, tenant_id: null };
    mocks.auth.me.mockResolvedValue(firstUser);

    mocks.functions.invoke.mockRejectedValue({
      response: {
        status: 500,
        data: {
          error: 'Erro interno do servidor',
          code: 'PROFILE_POSTCONDITION_FAILED',
        },
      },
      status: 500,
    });

    let state = null;
    render(
      <AuthProvider>
        <AuthConsumer onState={(s) => { state = s; }} />
      </AuthProvider>
    );

    await waitFor(() => expect(state?.authChecked).toBe(true));

    expect(mocks.functions.invoke).toHaveBeenCalledTimes(1);
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.authError).toBeTruthy();
    expect(state.authError.type).toBe('onboarding_error');
    expect(state.authError.code).toBe('PROFILE_POSTCONDITION_FAILED');
  });
});