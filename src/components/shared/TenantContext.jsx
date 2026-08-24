import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { getTenant } from '@/api/dataSource';
import { CLARITY_FEATURES } from '@/api/clarityClient';
import { queryClientInstance } from '@/lib/query-client';
import { resolveAppRole } from '@/lib/access-role';

const LS_KEY = 'fal_active_tenant_id';

export const TenantContext = createContext(null);

/**
 * @param {Object} props
 * @param {any=} props.children
 */
export function TenantProvider({ children }) {
  const { user, isAuthenticated, authChecked, isLoadingAuth } = useAuth();
  const [tenant, setTenant]           = useState(null);
  const [methodVersion, setMethodVersion] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [activeTenantId, setActiveTenantIdState] = useState(
    () => localStorage.getItem(LS_KEY) || null
  );

  useEffect(() => {
    // Só inicia carregamento quando auth está pronta
    if (!authChecked || isLoadingAuth || !isAuthenticated || !user) {
      if (!user && authChecked) {
        setTenant(null);
        setMethodVersion(null);
        setLoading(false);
      }
      return;
    }

    const timeout = setTimeout(() => {
      setLoading(prev => {
        if (prev) {
          setError('Tempo de carregamento excedido. Recarregue a página.');
        }
        return false;
      });
    }, 8000);

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const _appRole = resolveAppRole(user);
        const isHQRole = _appRole === 'hq_admin';
        const resolvedTenantId = isHQRole
          ? (activeTenantId || user.tenant_id || null)
          : (user.tenant_id || null);

        if (resolvedTenantId) {
          let t = null;
          try {
            t = await getTenant(resolvedTenantId);
          } catch (e) {
            console.warn('[TENANT] tenant_id inválido ou não encontrado:', resolvedTenantId);
          }
          if (t) {
            setTenant(t);
            if (t?.active_method_version_id) {
              base44.entities.MethodVersion.get(t.active_method_version_id)
                .then(mv => setMethodVersion(mv))
                .catch(() => {});
              return;
            }
          }
        }

        if (isHQRole || !resolvedTenantId) {
          base44.entities.MethodVersion.filter({ status: 'active' }, '-created_date', 1)
            .then(mvs => { if (mvs.length > 0) setMethodVersion(mvs[0]); })
            .catch(() => {});
        }
      } catch (e) {
        console.error('[TENANT] load error:', e);
        setError('Erro ao carregar sessão. Tente recarregar a página.');
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    }
    load();
    return () => clearTimeout(timeout);
  }, [authChecked, isLoadingAuth, isAuthenticated, user, activeTenantId]);

  const _appRole      = resolveAppRole(user);
  const isHQ          = _appRole === 'hq_admin';
  const isTenantAdmin = _appRole === 'tenant_admin';
  const isConsultant  = _appRole === 'consultant';
  const isClient      = _appRole === 'client_viewer';
  const tenantId      = isHQ
    ? (activeTenantId || user?.tenant_id || null)
    : (user?.tenant_id || null);
  const isReady       = !loading && !error && (!!tenantId || isHQ);

  const setActiveTenantId = useCallback(async (id) => {
    if (!isHQ) {
      console.warn('[SECURITY] Tentativa não autorizada de troca de tenant', {
        userId: user?.id, role: user?.role, requestedTenantId: id
      });
      return { ok: false, reason: 'TENANT_SWITCH_NOT_ALLOWED' };
    }

    if (id) {
      let targetTenant = null;
      try {
        targetTenant = await getTenant(id);
      } catch (e) {
        return { ok: false, reason: 'TENANT_NOT_FOUND' };
      }
      if (!targetTenant) {
        return { ok: false, reason: 'TENANT_NOT_FOUND' };
      }
      localStorage.setItem(LS_KEY, id);
    } else {
      localStorage.removeItem(LS_KEY);
    }

    queryClientInstance.clear();
    setActiveTenantIdState(id || null);
    window.location.href = '/';

    return { ok: true };
  }, [isHQ, user]);

  // Limpa tenant indevido armazenado para usuários não-HQ
  useEffect(() => {
    if (user && !isHQ && activeTenantId) {
      localStorage.removeItem(LS_KEY);
      setActiveTenantIdState(null);
    }
  }, [user, isHQ, activeTenantId]);



  return (
    <TenantContext.Provider value={{
      user, tenant, methodVersion,
      tenantId,
      activeTenantId,
      loading, error,
      isHQ, isTenantAdmin, isConsultant, isClient,
      isReady,
      setTenant, setMethodVersion,
      setActiveTenantId,
      clarityHierarchy: CLARITY_FEATURES.useClarityHierarchy,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}

/**
 * useTenantRequired()
 * Returns { loading } | { error } | { tenantId, user, isHQ, tenant, methodVersion }
 * Callers should check loading/error before using tenantId.
 */
export function useTenantRequired() {
  const ctx = useTenant();
  if (ctx.loading) return { loading: true };
  if (ctx.error)   return { error: ctx.error };
  if (!ctx.tenantId && !ctx.isHQ) return { error: 'TENANT_REQUIRED' };
  return {
    tenantId: ctx.tenantId,
    user: ctx.user,
    isHQ: ctx.isHQ,
    tenant: ctx.tenant,
    methodVersion: ctx.methodVersion,
    loading: false,
    error: null,
  };
}