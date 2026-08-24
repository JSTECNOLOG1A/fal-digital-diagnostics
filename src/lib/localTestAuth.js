/**
 * Auth local de desenvolvimento — NÃO usar em produção.
 * Ative com VITE_LOCAL_TEST_AUTH=true no .env.local.
 *
 * Importante: use o padrão literal `import.meta.env.*` para o Vite injetar os valores.
 */

export const LOCAL_TEST_AUTH_ENABLED =
  typeof import.meta.env !== 'undefined' &&
  // @ts-ignore Vite injeta ImportMetaEnv
  import.meta.env.MODE !== 'test' &&
  // @ts-ignore
  import.meta.env.DEV === true &&
  // @ts-ignore
  import.meta.env.VITE_LOCAL_TEST_AUTH === 'true';

export const LOCAL_TEST_CREDENTIALS = {
  email: 'admin@fal.local',
  password: 'FalTest123!',
};

const STORAGE_KEY = 'fal_local_test_session';

export function createLocalTestUser() {
  return {
    id: 'local-test-hq-admin',
    email: LOCAL_TEST_CREDENTIALS.email,
    full_name: 'Admin Local (teste)',
    name: 'Admin Local',
    role: 'admin',
    app_role: 'hq_admin',
    tenant_id: null,
    access_status: 'active',
    is_local_test_user: true,
  };
}

export function getLocalTestSession() {
  if (!LOCAL_TEST_AUTH_ENABLED || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.email === LOCAL_TEST_CREDENTIALS.email && parsed?.app_role) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveLocalTestSession(user) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function clearLocalTestSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function validateLocalTestCredentials(email, password) {
  const normalized = String(email || '').trim().toLowerCase();
  return (
    normalized === LOCAL_TEST_CREDENTIALS.email &&
    password === LOCAL_TEST_CREDENTIALS.password
  );
}
