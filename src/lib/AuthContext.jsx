import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { clarity, CLARITY_FEATURES } from '@/api/clarityClient';
import { mapClarityUserToAppUser } from '@/api/clarityMappers';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';
import { queryClientInstance } from '@/lib/query-client';
import {
  LOCAL_TEST_AUTH_ENABLED,
  clearLocalTestSession,
  createLocalTestUser,
  getLocalTestSession,
  saveLocalTestSession,
  validateLocalTestCredentials,
} from '@/lib/localTestAuth';

const AuthContext = createContext(undefined);

/** Login por e-mail/senha (API própria ou mock local). */
export const PASSWORD_LOGIN_ENABLED =
  LOCAL_TEST_AUTH_ENABLED || CLARITY_FEATURES.useClarityAuth;

function hasClarityAccessToken() {
  if (typeof window === 'undefined') return false;
  return !!window.localStorage.getItem('clarity.accessToken');
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const checkingRef = useRef(false);

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    try {
      setAuthChecked(false);
      setIsLoadingPublicSettings(true);
      setIsLoadingAuth(true);
      setAuthError(null);

      // ── Auth via API própria (Clarity/FAL) ──
      if (CLARITY_FEATURES.useClarityAuth) {
        setAppPublicSettings({
          id: appParams.appId || 'fal-api',
          public_settings: { clarity_auth: true, local_test_auth: LOCAL_TEST_AUTH_ENABLED },
        });

        if (hasClarityAccessToken()) {
          try {
            const me = await clarity.me();
            if (me?.accessStatus === 'revoked') {
              await clarity.logout().catch(() => {});
              setUser(null);
              setIsAuthenticated(false);
              setAuthError({
                type: 'access_revoked',
                message: 'Seu acesso foi desativado. Entre em contato com o administrador.',
              });
            } else {
              setUser(mapClarityUserToAppUser(me));
              setIsAuthenticated(true);
            }
          } catch {
            await clarity.logout().catch(() => {});
            setUser(null);
            setIsAuthenticated(false);
          }
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }

        setAuthChecked(true);
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
        return;
      }

      // ── Auth local offline (sem API) ──
      if (LOCAL_TEST_AUTH_ENABLED) {
        const localUser = getLocalTestSession();
        setAppPublicSettings({
          id: appParams.appId || 'local-test-app',
          public_settings: { local_test_auth: true },
        });
        if (localUser) {
          setUser(localUser);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
        setAuthChecked(true);
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
        return;
      }

      const appClient = createAxiosClient({
        baseURL: `/api/apps/public`,
        headers: { 'X-App-Id': appParams.appId },
        token: appParams.token,
        interceptResponses: true
      });

      try {
        const [publicSettings, userAuth] = await Promise.all([
          appClient.get(`/prod/public-settings/by-id/${appParams.appId}`),
          appParams.token ? base44.auth.me().catch(() => null) : Promise.resolve(null)
        ]);

        setAppPublicSettings(publicSettings);

        let resolvedUser = userAuth;
        let onboardingError = null;

        if (resolvedUser && !resolvedUser.app_role) {
          try {
            const result = await base44.functions.invoke('applyPendingUserAccessProfile', {});
            if (result?.data?.success) {
              const previousTenantId = resolvedUser.tenant_id;
              resolvedUser = await base44.auth.me();
              if (resolvedUser?.tenant_id !== previousTenantId) {
                queryClientInstance.clear();
                try {
                  if (resolvedUser?.tenant_id) {
                    localStorage.setItem('fal_active_tenant_id', resolvedUser.tenant_id);
                  } else {
                    localStorage.removeItem('fal_active_tenant_id');
                  }
                } catch {
                  // storage indisponível (ex.: mock incompleto em testes)
                }
              }
            }
          } catch (error) {
            const status = error?.response?.status || error?.status;
            if (status !== 404) {
              onboardingError = {
                type: 'onboarding_error',
                status,
                code: error?.response?.data?.code || error?.code || 'ONBOARDING_FAILED',
                message: error?.response?.data?.error || error?.message || 'Não foi possível aplicar o perfil de acesso.',
              };
            }
          }
        }

        if (onboardingError) {
          setUser(null);
          setIsAuthenticated(false);
          setAuthError(onboardingError);
          setAuthChecked(true);
          setIsLoadingPublicSettings(false);
          setIsLoadingAuth(false);
          return;
        }

        if (resolvedUser?.access_status === 'revoked') {
          setUser(null);
          setIsAuthenticated(false);
          setAuthError({ type: 'access_revoked', message: 'Seu acesso foi desativado. Entre em contato com o administrador.' });
        } else if (resolvedUser) {
          setUser(resolvedUser);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }

        setAuthChecked(true);
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      } catch (appError) {
        console.error('App state check failed:', appError);

        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({ type: 'auth_required', message: 'Authentication required' });
          } else if (reason === 'user_not_registered') {
            setAuthError({ type: 'user_not_registered', message: 'User not registered for this app' });
          } else {
            setAuthError({ type: reason, message: appError.message });
          }
        } else {
          setAuthError({ type: 'unknown', message: appError.message || 'Failed to load app' });
        }
        setAuthChecked(true);
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({ type: 'unknown', message: error.message || 'An unexpected error occurred' });
      setAuthChecked(true);
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    } finally {
      checkingRef.current = false;
    }
  };

  /**
   * Login e-mail/senha — API Clarity quando VITE_CLARITY_AUTH=true,
   * senão mock local (VITE_LOCAL_TEST_AUTH).
   */
  const loginLocal = async (email, password) => {
    if (CLARITY_FEATURES.useClarityAuth) {
      try {
        const data = await clarity.login(email, password);
        const appUser = mapClarityUserToAppUser(data.user);
        if (LOCAL_TEST_AUTH_ENABLED) {
          // Mantém sessão espelhada para o client local de entidades ainda não migradas
          saveLocalTestSession(appUser);
        }
        setUser(appUser);
        setIsAuthenticated(true);
        setAuthError(null);
        setAuthChecked(true);
        setIsLoadingAuth(false);
        setIsLoadingPublicSettings(false);
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          message: error?.message?.replace(/^Clarity API \d+:\s*/, '') || 'Falha no login',
        };
      }
    }

    if (!LOCAL_TEST_AUTH_ENABLED) {
      return { ok: false, message: 'Auth local desabilitada' };
    }
    if (!validateLocalTestCredentials(email, password)) {
      return { ok: false, message: 'E-mail ou senha inválidos' };
    }
    const localUser = createLocalTestUser();
    saveLocalTestSession(localUser);
    setUser(localUser);
    setIsAuthenticated(true);
    setAuthError(null);
    setAuthChecked(true);
    setIsLoadingAuth(false);
    setIsLoadingPublicSettings(false);
    return { ok: true };
  };

  const logout = async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);

    queryClientInstance.clear();
    try {
      if (typeof localStorage !== 'undefined' && typeof localStorage.removeItem === 'function') {
        localStorage.removeItem('fal_active_tenant_id');
      }
    } catch {
      // jsdom / ambiente de teste pode mockar localStorage parcialmente
    }

    if (CLARITY_FEATURES.useClarityAuth) {
      try {
        await clarity.logout();
      } catch {
        // ignore
      }
      clearLocalTestSession();
      if (shouldRedirect && typeof window !== 'undefined') {
        window.location.href = '/';
      }
      return;
    }

    if (LOCAL_TEST_AUTH_ENABLED) {
      clearLocalTestSession();
      if (shouldRedirect && typeof window !== 'undefined') {
        window.location.href = '/';
      }
      return;
    }

    if (shouldRedirect) {
      base44.auth.logout(window.location.href);
    } else {
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    if (PASSWORD_LOGIN_ENABLED) {
      return;
    }
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated,
      authChecked,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      loginLocal,
      checkAppState,
      isLocalTestAuth: LOCAL_TEST_AUTH_ENABLED,
      isClarityAuth: CLARITY_FEATURES.useClarityAuth,
      passwordLoginEnabled: PASSWORD_LOGIN_ENABLED,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
