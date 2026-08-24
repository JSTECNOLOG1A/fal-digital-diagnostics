/**
 * Dual-read/write adapter: Base44/local today, Clarity API when feature flags are on.
 * Migrate one domain at a time by flipping VITE_CLARITY_* envs.
 */
import { base44 } from './base44Client';
import { clarity, CLARITY_FEATURES } from './clarityClient';
import {
  mapCompanyFromApi,
  mapGroupFromApi,
  mapTenantFromApi,
  mapUnitFromApi,
} from './clarityMappers';

export { CLARITY_FEATURES, clarity };

function sortByName(a, b) {
  return String(a?.name || '').localeCompare(String(b?.name || ''), 'pt-BR');
}

export async function listTenants() {
  if (CLARITY_FEATURES.useClarityAuth || CLARITY_FEATURES.useClarityHierarchy) {
    const rows = await clarity.listTenants();
    const list = Array.isArray(rows) ? rows : rows?.data || [];
    return list.map(mapTenantFromApi).filter(Boolean).sort(sortByName);
  }
  return base44.entities.Tenant.filter({ active: true }, 'name', 100);
}

export async function createTenant(data) {
  if (CLARITY_FEATURES.useClarityAuth || CLARITY_FEATURES.useClarityHierarchy) {
    const created = await clarity.createTenant({
      name: data.name,
      slug: data.slug,
      logoUrl: data.logo_url || data.logoUrl,
    });
    return mapTenantFromApi(created);
  }
  return base44.entities.Tenant.create(data);
}

export async function getTenant(id) {
  if (!id) return null;
  if (CLARITY_FEATURES.useClarityAuth || CLARITY_FEATURES.useClarityHierarchy) {
    try {
      const row = await clarity.getTenant(id);
      return mapTenantFromApi(row);
    } catch {
      return null;
    }
  }
  return base44.entities.Tenant.get(id);
}

export async function listGroups(tenantId) {
  if (CLARITY_FEATURES.useClarityHierarchy) {
    let rows = await clarity.listGroups();
    rows = rows.map(mapGroupFromApi).filter(Boolean);
    if (tenantId) {
      rows = rows.filter((g) => g.tenant_id === tenantId);
    }
    return rows.sort(sortByName);
  }
  if (tenantId) {
    return base44.entities.Group.filter({ tenant_id: tenantId });
  }
  return base44.entities.Group.filter({});
}

export async function createGroup(data) {
  if (CLARITY_FEATURES.useClarityHierarchy) {
    const created = await clarity.createGroup({
      name: data.name,
      tenantId: data.tenant_id || data.tenantId,
    });
    return mapGroupFromApi(created);
  }
  return base44.entities.Group.create(data);
}

export async function getGroup(id) {
  if (CLARITY_FEATURES.useClarityHierarchy) {
    const rows = await listGroups();
    return rows.find((g) => g.id === id) || null;
  }
  return base44.entities.Group.get(id);
}

export async function listCompanies(groupId) {
  if (CLARITY_FEATURES.useClarityHierarchy) {
    const rows = await clarity.listCompanies(groupId);
    return rows.map(mapCompanyFromApi).filter(Boolean).sort(sortByName);
  }
  if (groupId) {
    return base44.entities.Company.filter({ group_id: groupId });
  }
  return base44.entities.Company.filter({});
}

export async function createCompany(data) {
  if (CLARITY_FEATURES.useClarityHierarchy) {
    const created = await clarity.createCompany({
      name: data.name,
      groupId: data.group_id || data.groupId,
      tenantId: data.tenant_id || data.tenantId,
      cnpj: data.cnpj,
      sector: data.sector,
      erpSystem: data.erp_system || data.erpSystem,
    });
    return mapCompanyFromApi(created);
  }
  return base44.entities.Company.create(data);
}

export async function listUnits(companyId) {
  if (CLARITY_FEATURES.useClarityHierarchy) {
    const rows = await clarity.listUnits(companyId);
    return rows.map(mapUnitFromApi).filter(Boolean).sort(sortByName);
  }
  if (companyId) {
    return base44.entities.OperationalUnit.filter({ company_id: companyId });
  }
  return base44.entities.OperationalUnit.filter({});
}

export async function inviteUser(payload) {
  if (CLARITY_FEATURES.useClarityUsers) {
    return clarity.inviteUser({
      email: payload.email,
      name: payload.name,
      role: payload.role || payload.app_role,
      tenantId: payload.tenant_id || payload.tenantId,
      clientId: payload.client_id || payload.clientId,
      temporaryPassword: payload.temporaryPassword,
    });
  }
  return base44.functions.invoke('inviteUserWithAccessProfile', payload);
}

export async function revokeUser(payload) {
  if (CLARITY_FEATURES.useClarityUsers) {
    return clarity.revokeUser({
      userId: payload.userId || payload.user_id,
      reason: payload.reason,
    });
  }
  return base44.functions.invoke('revokeUserAccess', payload);
}
