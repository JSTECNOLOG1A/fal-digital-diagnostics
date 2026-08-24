import {
  clearLocalTestSession,
  createLocalTestUser,
  getLocalTestSession,
} from '../lib/localTestAuth.js';
import { clarity, CLARITY_FEATURES } from './clarityClient.js';
import {
  mapCompanyFromApi,
  mapGroupFromApi,
  mapTenantFromApi,
  mapUnitFromApi,
} from './clarityMappers.js';

const store = new Map();

function makeId(prefix = 'local') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function getCollection(entity) {
  if (!store.has(entity)) store.set(entity, new Map());
  return store.get(entity);
}

function matchesQuery(record, query = {}) {
  return Object.entries(query).every(([key, value]) => record?.[key] === value);
}

function createEntityApi(entity) {
  return {
    async list(sort, limit = 100) {
      const rows = [...getCollection(entity).values()];
      return typeof limit === 'number' ? rows.slice(0, limit) : rows;
    },
    async filter(query = {}, sort, limit = 100) {
      const rows = [...getCollection(entity).values()].filter((row) => matchesQuery(row, query));
      return typeof limit === 'number' ? rows.slice(0, limit) : rows;
    },
    async get(id) {
      const row = getCollection(entity).get(id);
      if (!row) {
        /** @type {any} */
        const error = new Error(`${entity} not found`);
        error.status = 404;
        throw error;
      }
      return row;
    },
    async create(data = {}) {
      const id = data.id || makeId(entity);
      const row = {
        ...data,
        id,
        created_date: data.created_date || new Date().toISOString(),
        updated_date: new Date().toISOString(),
      };
      getCollection(entity).set(id, row);
      return row;
    },
    async update(id, data = {}) {
      const current = await this.get(id);
      const row = {
        ...current,
        ...data,
        id,
        updated_date: new Date().toISOString(),
      };
      getCollection(entity).set(id, row);
      return row;
    },
    async delete(id) {
      getCollection(entity).delete(id);
      return { id };
    },
    async deleteMany(ids = []) {
      ids.forEach((id) => getCollection(entity).delete(id));
      return { deleted: ids.length };
    },
    async bulkCreate(items = []) {
      return Promise.all(items.map((item) => this.create(item)));
    },
    subscribe() {
      return () => {};
    },
  };
}


function createClarityHierarchyEntity(entityName) {
  const local = createEntityApi(entityName);

  if (entityName === 'Tenant') {
    return {
      ...local,
      async list() {
        const rows = await clarity.listTenants();
        return rows.map(mapTenantFromApi).filter(Boolean);
      },
      async filter(query = {}) {
        let rows = await this.list();
        if (query.active === true || query.is_active === true) {
          rows = rows.filter((t) => t.active);
        }
        if (query.slug) rows = rows.filter((t) => t.slug === query.slug);
        return rows;
      },
      async get(id) {
        const row = mapTenantFromApi(await clarity.getTenant(id));
        if (!row) {
          const error = new Error('Tenant not found');
          error.status = 404;
          throw error;
        }
        return row;
      },
      async create(data = {}) {
        const created = await clarity.createTenant({
          name: data.name,
          slug: data.slug,
          logoUrl: data.logo_url || data.logoUrl,
        });
        return mapTenantFromApi(created);
      },
      async update(id, data = {}) {
        const body = {};
        if (data.name !== undefined) body.name = data.name;
        if (data.logo_url !== undefined || data.logoUrl !== undefined) {
          body.logoUrl = data.logo_url ?? data.logoUrl;
        }
        if (data.active !== undefined) body.isActive = data.active;
        if (data.is_active !== undefined) body.isActive = data.is_active;
        const updated = await clarity.updateTenant(id, body);
        return mapTenantFromApi(updated);
      },
    };
  }

  if (entityName === 'Group') {
    return {
      ...local,
      async list() {
        const rows = await clarity.listGroups();
        return rows.map(mapGroupFromApi).filter(Boolean);
      },
      async filter(query = {}) {
        let rows = await this.list();
        if (query.tenant_id) rows = rows.filter((g) => g.tenant_id === query.tenant_id);
        return rows;
      },
      async get(id) {
        const row = (await this.list()).find((g) => g.id === id);
        if (!row) {
          const error = new Error('Group not found');
          error.status = 404;
          throw error;
        }
        return row;
      },
      async create(data = {}) {
        const created = await clarity.createGroup({
          name: data.name,
          tenantId: data.tenant_id || data.tenantId,
        });
        return mapGroupFromApi(created);
      },
      async update(id, data = {}) {
        const body = {};
        if (data.name !== undefined) body.name = data.name;
        if (data.is_archived !== undefined) body.isArchived = data.is_archived;
        const updated = await clarity.updateGroup(id, body);
        return mapGroupFromApi(updated);
      },
      async delete(id) {
        await clarity.deleteGroup(id);
        return { id };
      },
    };
  }

  if (entityName === 'Company') {
    return {
      ...local,
      async list() {
        const rows = await clarity.listCompanies();
        return rows.map(mapCompanyFromApi).filter(Boolean);
      },
      async filter(query = {}) {
        let rows = await clarity.listCompanies(query.group_id, {
          includeArchived: query.include_archived === true || query.includeArchived === true,
        });
        rows = rows.map(mapCompanyFromApi).filter(Boolean);
        if (query.tenant_id) rows = rows.filter((c) => c.tenant_id === query.tenant_id);
        if (query.group_id) rows = rows.filter((c) => c.group_id === query.group_id);
        if (query.is_archived === false) rows = rows.filter((c) => !c.is_archived);
        if (query.is_archived === true) rows = rows.filter((c) => c.is_archived);
        return rows;
      },
      async get(id) {
        const row = (await this.list()).find((c) => c.id === id);
        if (!row) {
          const error = new Error('Company not found');
          error.status = 404;
          throw error;
        }
        return row;
      },
      async create(data = {}) {
        const created = await clarity.createCompany({
          name: data.name,
          groupId: data.group_id || data.groupId,
          tenantId: data.tenant_id || data.tenantId,
          cnpj: data.cnpj || data.tax_id,
          sector: data.sector,
          erpSystem: data.erp_system || data.erpSystem,
        });
        return mapCompanyFromApi(created);
      },
      async update(id, data = {}) {
        const body = {};
        if (data.name !== undefined) body.name = data.name;
        if (data.cnpj !== undefined) body.cnpj = data.cnpj;
        if (data.sector !== undefined) body.sector = data.sector;
        if (data.erp_system !== undefined || data.erpSystem !== undefined) {
          body.erpSystem = data.erp_system ?? data.erpSystem;
        }
        if (data.is_archived !== undefined) body.isArchived = data.is_archived;
        const updated = await clarity.updateCompany(id, body);
        return mapCompanyFromApi(updated);
      },
      async delete(id) {
        await clarity.deleteCompany(id);
        return { id };
      },
    };
  }

  if (entityName === 'OperationalUnit') {
    return {
      ...local,
      async list() {
        const rows = await clarity.listUnits();
        return rows.map(mapUnitFromApi).filter(Boolean);
      },
      async filter(query = {}) {
        let rows = await clarity.listUnits(query.company_id);
        rows = rows.map(mapUnitFromApi).filter(Boolean);
        if (query.tenant_id) rows = rows.filter((u) => u.tenant_id === query.tenant_id);
        return rows;
      },
      async get(id) {
        const row = (await this.list()).find((u) => u.id === id);
        if (!row) {
          const error = new Error('OperationalUnit not found');
          error.status = 404;
          throw error;
        }
        return row;
      },
      async create(data = {}) {
        const created = await clarity.createUnit({
          name: data.name,
          companyId: data.company_id || data.companyId,
          tenantId: data.tenant_id || data.tenantId,
          code: data.code,
        });
        return mapUnitFromApi(created);
      },
      async update(id, data = {}) {
        const body = {};
        if (data.name !== undefined) body.name = data.name;
        if (data.code !== undefined) body.code = data.code;
        if (data.is_active !== undefined) body.isActive = data.is_active;
        if (data.is_archived !== undefined) body.isArchived = data.is_archived;
        const updated = await clarity.updateUnit(id, body);
        return mapUnitFromApi(updated);
      },
      async delete(id) {
        await clarity.deleteUnit(id);
        return { id };
      },
    };
  }

  return local;
}

/**
 * Client Base44 offline — sem rede, sem redirect, dados só em memória.
 */
export function createLocalBase44Client() {
  seedLocalDemoData();

  const hierarchyEntities = new Set([
    'Tenant',
    'Group',
    'Company',
    'OperationalUnit',
  ]);

  const entities = new Proxy(
    {},
    {
      get(_target, entityName) {
        if (typeof entityName !== 'string' || entityName === 'then') return undefined;
        if (
          CLARITY_FEATURES.useClarityHierarchy &&
          hierarchyEntities.has(entityName)
        ) {
          return createClarityHierarchyEntity(entityName);
        }
        return createEntityApi(entityName);
      },
    }
  );

  return {
    entities,
    auth: {
      async me() {
        if (CLARITY_FEATURES.useClarityAuth) {
          const { mapClarityUserToAppUser } = await import('./clarityMappers.js');
          return mapClarityUserToAppUser(await clarity.me());
        }
        return getLocalTestSession() || createLocalTestUser();
      },
      async isAuthenticated() {
        if (CLARITY_FEATURES.useClarityAuth) {
          return !!localStorage.getItem('clarity.accessToken');
        }
        return !!getLocalTestSession();
      },
      setToken() {},
      redirectToLogin() {},
      logout() {
        if (CLARITY_FEATURES.useClarityAuth) {
          clarity.logout().catch(() => {});
        }
        clearLocalTestSession();
      },
      loginWithProvider() {},
      async loginViaEmailPassword() {
        throw new Error('Use o login local da tela de desenvolvimento');
      },
      async updateMe(data = {}) {
        const current = getLocalTestSession() || createLocalTestUser();
        const next = { ...current, ...data };
        // Persistência fica a cargo do AuthContext/session local.
        return next;
      },
    },
    functions: {
      async invoke(name, payload = {}) {
        console.info(`[local-base44] function: ${name}`, payload);

        if (name === 'deleteAccountPlanLines') {
          const planId = payload.account_plan_id;
          const tenantId = payload.tenant_id;
          if (!planId || !tenantId) {
            throw new Error('account_plan_id e tenant_id são obrigatórios');
          }
          const linesApi = createEntityApi('FinancialAccountPlanLine');
          let lines = await linesApi.filter(
            { account_plan_id: planId, tenant_id: tenantId },
            'account_code',
            20000,
          );
          if (lines.length === 0) {
            lines = await linesApi.filter(
              { account_plan_id: planId },
              'account_code',
              20000,
            );
          }
          const ids = lines.map((l) => l.id);
          await linesApi.deleteMany(ids);
          return {
            data: {
              success: true,
              deleted: ids.length,
              failed: 0,
              total: ids.length,
              message: `${ids.length} linhas deletadas`,
            },
            deleted: ids.length,
            failed: 0,
            total: ids.length,
          };
        }

        if (name === 'deleteAccountPlan') {
          const planId = payload.account_plan_id;
          const tenantId = payload.tenant_id;
          if (!planId) throw new Error('account_plan_id é obrigatório');

          const plansApi = createEntityApi('FinancialAccountPlan');
          const plan = await plansApi.get(planId);
          const canonicalTenantId = plan.tenant_id || tenantId;

          const linesApi = createEntityApi('FinancialAccountPlanLine');
          const lines = await linesApi.filter(
            { account_plan_id: planId, tenant_id: canonicalTenantId },
            'account_code',
            20000,
          );
          await linesApi.deleteMany(lines.map((l) => l.id));
          await plansApi.delete(planId);

          return {
            data: {
              success: true,
              deleted_lines: lines.length,
              deleted_plan: true,
            },
            deleted_lines: lines.length,
          };
        }

        console.info(`[local-base44] function stub (sem implementação): ${name}`);
        return {
          data: {
            success: true,
            local: true,
            function: name,
            message: 'Base44 desconectado — função local stub',
          },
        };
      },
    },
    integrations: new Proxy(
      {},
      {
        get() {
          return new Proxy(
            {},
            {
              get() {
                return async () => ({ local: true });
              },
            }
          );
        },
      }
    ),
    appLogs: {
      async logUserInApp() {},
      async fetchLogs() {
        return [];
      },
      async getStats() {
        return {};
      },
    },
    users: {
      async inviteUser() {
        return { success: true, local: true };
      },
    },
    agents: {
      async getConversations() {
        return [];
      },
      async listConversations() {
        return [];
      },
    },
    analytics: {
      track() {},
      cleanup() {},
    },
    setToken() {},
    getConfig() {
      return { serverUrl: 'local://offline', appId: 'local-test-app', requiresAuth: false };
    },
    cleanup() {
      store.clear();
    },
  };
}

function seedEntity(entity, records) {
  const collection = getCollection(entity);
  for (const record of records) {
    collection.set(record.id, {
      ...record,
      created_date: record.created_date || new Date().toISOString(),
      updated_date: record.updated_date || new Date().toISOString(),
    });
  }
}

function seedLocalDemoData() {
  if (getCollection('Tenant').size > 0) return;

  const methodVersionId = 'local-method-v1';
  const tenantId = 'local-tenant-demo';

  seedEntity('MethodVersion', [
    {
      id: methodVersionId,
      name: 'Método FAL Local v1',
      version: '1.0.0-local',
      status: 'active',
      description: 'Versão seed para desenvolvimento offline',
    },
  ]);

  seedEntity('Tenant', [
    {
      id: tenantId,
      name: 'Tenant Demo Local',
      slug: 'demo-local',
      active: true,
      active_method_version_id: methodVersionId,
      logo_url: '',
    },
    {
      id: 'local-tenant-agro',
      name: 'Agro Consultoria Demo',
      slug: 'agro-demo',
      active: true,
      active_method_version_id: methodVersionId,
      logo_url: '',
    },
  ]);

  seedEntity('Group', [
    {
      id: 'local-group-1',
      name: 'Grupo Demo FAL',
      tenant_id: tenantId,
      status: 'active',
    },
  ]);

  seedEntity('Company', [
    {
      id: 'local-company-1',
      name: 'Fazenda Demo Ltda',
      tenant_id: tenantId,
      group_id: 'local-group-1',
      status: 'active',
    },
  ]);
}

