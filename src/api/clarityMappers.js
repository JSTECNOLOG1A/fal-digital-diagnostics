/**
 * Adapters: API Clarity (camelCase) ↔ formato Base44/FAL (snake_case).
 */

export function mapClarityUserToAppUser(user) {
  if (!user) return null;
  const access =
    user.accessStatus || user.access_status || 'active';
  return {
    id: user.id,
    email: user.email,
    full_name: user.name,
    name: user.name,
    role: user.role === 'hq_admin' ? 'admin' : 'user',
    app_role: user.role,
    tenant_id: user.tenantId ?? user.tenant_id ?? null,
    client_id: user.clientId ?? user.client_id ?? null,
    access_status: access,
    is_clarity_user: true,
  };
}

export function mapTenantFromApi(t) {
  if (!t) return null;
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    logo_url: t.logoUrl ?? null,
    active: t.isActive !== false && !t.deletedAt,
    is_active: t.isActive !== false,
    created_date: t.createdAt,
    updated_date: t.updatedAt,
  };
}

export function mapGroupFromApi(g) {
  if (!g) return null;
  return {
    id: g.id,
    name: g.name,
    tenant_id: g.tenantId,
    is_archived: !!g.deletedAt,
    created_date: g.createdAt,
    updated_date: g.updatedAt,
    companies: Array.isArray(g.companies)
      ? g.companies.map(mapCompanyFromApi)
      : undefined,
  };
}

export function mapCompanyFromApi(c) {
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    tenant_id: c.tenantId,
    group_id: c.groupId,
    cnpj: c.cnpj ?? null,
    tax_id: c.cnpj ?? c.tax_id ?? null,
    sector: c.sector ?? null,
    erp_system: c.erpSystem ?? null,
    is_archived: !!c.deletedAt,
    created_date: c.createdAt,
    updated_date: c.updatedAt,
    units: Array.isArray(c.units) ? c.units.map(mapUnitFromApi) : undefined,
  };
}

export function mapUnitFromApi(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    code: u.code ?? null,
    tenant_id: u.tenantId,
    company_id: u.companyId,
    is_active: !u.deletedAt,
    is_archived: !!u.deletedAt,
    created_date: u.createdAt,
    updated_date: u.updatedAt,
  };
}
