/**
 * Bridge to Clarity API during Base44 cutover.
 * Mirror of apps/web/src/api/clarityClient.ts (JS for current Vite app).
 */

const DEFAULT_BASE =
  (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_CLARITY_API_URL) ||
  'http://localhost:3001/api/v1';

const storageKeys = {
  access: 'clarity.accessToken',
  refresh: 'clarity.refreshToken',
};

function getAccess() {
  return localStorage.getItem(storageKeys.access);
}

function getRefresh() {
  return localStorage.getItem(storageKeys.refresh);
}

function setTokens(tokens) {
  if (!tokens) {
    localStorage.removeItem(storageKeys.access);
    localStorage.removeItem(storageKeys.refresh);
    return;
  }
  localStorage.setItem(storageKeys.access, tokens.accessToken);
  localStorage.setItem(storageKeys.refresh, tokens.refreshToken);
}

export class ClarityClient {
  constructor(opts = {}) {
    this.baseUrl = (opts.baseUrl || DEFAULT_BASE).replace(/\/$/, '');
    this.getAccessToken = opts.getAccessToken || getAccess;
    this.getRefreshToken = opts.getRefreshToken || getRefresh;
    this.setTokens = opts.setTokens || setTokens;
    this.onUnauthorized = opts.onUnauthorized;
    this.refreshPromise = null;
  }

  async login(email, password) {
    const data = await this.request('POST', '/auth/login', { email, password }, { auth: false });
    this.setTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
    });
    return data;
  }

  async logout() {
    const refreshToken = this.getRefreshToken();
    try {
      if (this.getAccessToken()) {
        await this.request('POST', '/auth/logout', { refreshToken });
      }
    } finally {
      this.setTokens(null);
    }
  }

  me() {
    return this.request('GET', '/auth/me');
  }

  listGroups() {
    return this.request('GET', '/groups');
  }

  createGroup(body) {
    return this.request('POST', '/groups', body);
  }

  listCompanies(groupId, opts = {}) {
    const params = new URLSearchParams();
    if (groupId) params.set('groupId', groupId);
    if (opts.includeArchived) params.set('includeArchived', 'true');
    const q = params.toString() ? `?${params.toString()}` : '';
    return this.request('GET', `/companies${q}`);
  }

  createCompany(body) {
    return this.request('POST', '/companies', body);
  }

  listUnits(companyId) {
    const q = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    return this.request('GET', `/units${q}`);
  }

  createUnit(body) {
    return this.request('POST', '/units', body);
  }

  updateGroup(id, body) {
    return this.request('PATCH', `/groups/${encodeURIComponent(id)}`, body);
  }

  deleteGroup(id) {
    return this.request('DELETE', `/groups/${encodeURIComponent(id)}`);
  }

  updateCompany(id, body) {
    return this.request('PATCH', `/companies/${encodeURIComponent(id)}`, body);
  }

  deleteCompany(id) {
    return this.request('DELETE', `/companies/${encodeURIComponent(id)}`);
  }

  updateUnit(id, body) {
    return this.request('PATCH', `/units/${encodeURIComponent(id)}`, body);
  }

  deleteUnit(id) {
    return this.request('DELETE', `/units/${encodeURIComponent(id)}`);
  }

  updateTenant(id, body) {
    return this.request('PATCH', `/tenants/${encodeURIComponent(id)}`, body);
  }

  inviteUser(body) {
    return this.request('POST', '/users/invite', body);
  }

  revokeUser(body) {
    return this.request('POST', '/users/revoke', body);
  }

  listUsers() {
    return this.request('GET', '/users');
  }

  listTenants() {
    return this.request('GET', '/tenants');
  }

  createTenant(body) {
    return this.request('POST', '/tenants', body);
  }

  getTenant(tenantId) {
    return this.request('GET', `/tenants/${encodeURIComponent(tenantId)}`);
  }

  getProtheusConnection(tenantId) {
    const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    return this.request('GET', `/integrations/protheus/connection${q}`);
  }

  upsertProtheusConnection(body) {
    return this.request('POST', '/integrations/protheus/connection', body);
  }

  startProtheusSync(body) {
    return this.request('POST', '/integrations/protheus/sync', body);
  }

  fetchProtheusResource(body) {
    return this.request('POST', '/integrations/protheus/fetch', body);
  }

  discoverProtheus(body) {
    return this.request('POST', '/integrations/protheus/discover', body);
  }

  listProtheusJobs(tenantId) {
    const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    return this.request('GET', `/integrations/protheus/jobs${q}`);
  }

  listProtheusStaging(tenantId, resource) {
    const params = new URLSearchParams();
    if (tenantId) params.set('tenantId', tenantId);
    if (resource) params.set('resource', resource);
    const q = params.toString() ? `?${params.toString()}` : '';
    return this.request('GET', `/integrations/protheus/staging${q}`);
  }

  // ── Integrações genéricas ─────────────────────────────────

  listIntegrationConnections(tenantId) {
    const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    return this.request('GET', `/integrations/connections${q}`);
  }

  upsertIntegrationConnection(body) {
    return this.request('POST', '/integrations/connections', body);
  }

  listIntegrationApiKeys(tenantId) {
    const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    return this.request('GET', `/integrations/api-keys${q}`);
  }

  createIntegrationApiKey(body) {
    return this.request('POST', '/integrations/api-keys', body);
  }

  revokeIntegrationApiKey(id, tenantId) {
    const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    return this.request('DELETE', `/integrations/api-keys/${encodeURIComponent(id)}${q}`);
  }

  listWebhookEndpoints(tenantId) {
    const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    return this.request('GET', `/integrations/webhooks/endpoints${q}`);
  }

  createWebhookEndpoint(body) {
    return this.request('POST', '/integrations/webhooks/endpoints', body);
  }

  dispatchWebhook(body) {
    return this.request('POST', '/integrations/webhooks/dispatch', body);
  }

  listInboundEvents(tenantId, provider) {
    const params = new URLSearchParams();
    if (tenantId) params.set('tenantId', tenantId);
    if (provider) params.set('provider', provider);
    const q = params.toString() ? `?${params.toString()}` : '';
    return this.request('GET', `/integrations/inbound-events${q}`);
  }

  listIntegrationJobs(tenantId) {
    const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    return this.request('GET', `/integrations/jobs${q}`);
  }

  async request(method, path, body, opts = {}) {
    const auth = opts.auth !== false;
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth) {
      const token = this.getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const tenantId =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem('fal_active_tenant_id')
          : null;
      if (tenantId) headers['X-Tenant-Id'] = tenantId;
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (res.status === 401 && auth && opts.retry !== false) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        return this.request(method, path, body, { ...opts, retry: false });
      }
      this.setTokens(null);
      this.onUnauthorized?.();
      throw new Error('Clarity API 401: Unauthorized');
    }

    if (!res.ok) {
      let message = res.statusText;
      try {
        const err = await res.json();
        message = Array.isArray(err.message)
          ? err.message.join(', ')
          : err.message || message;
      } catch {
        /* ignore */
      }
      throw new Error(`Clarity API ${res.status}: ${message}`);
    }

    if (res.status === 204) return undefined;
    return res.json();
  }

  async tryRefresh() {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) return false;
      try {
        const res = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        this.setTokens(data);
        return true;
      } catch {
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();
    return this.refreshPromise;
  }
}

export const clarity = new ClarityClient();

/** Flip per domain when ready to leave Base44 */
export const CLARITY_FEATURES = {
  useClarityAuth:
    typeof import.meta.env !== 'undefined' &&
    import.meta.env.VITE_CLARITY_AUTH === 'true',
  useClarityHierarchy:
    typeof import.meta.env !== 'undefined' &&
    import.meta.env.VITE_CLARITY_HIERARCHY === 'true',
  useClarityUsers:
    typeof import.meta.env !== 'undefined' &&
    import.meta.env.VITE_CLARITY_USERS === 'true',
  useClarityProtheus:
    typeof import.meta.env !== 'undefined' &&
    (import.meta.env.VITE_CLARITY_PROTHEUS === 'true' ||
      import.meta.env.VITE_CLARITY_INTEGRATIONS === 'true' ||
      import.meta.env.VITE_CLARITY_AUTH === 'true'),
  useClarityIntegrations:
    typeof import.meta.env !== 'undefined' &&
    (import.meta.env.VITE_CLARITY_INTEGRATIONS === 'true' ||
      import.meta.env.VITE_CLARITY_AUTH === 'true'),
};
