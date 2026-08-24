export const validAppRoles = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);

export function resolveAppRole(user) {
  if (!user || user.access_status === 'revoked') return null;
  if (validAppRoles.has(user.app_role)) return user.app_role;
  return user.role === 'admin' ? 'hq_admin' : null;
}

export function canManageAccess(actor, target) {
  const role = resolveAppRole(actor);
  if (!['hq_admin', 'tenant_admin'].includes(role || '') || actor.id === target.id) return false;
  if (role === 'hq_admin') return target.role !== 'admin';
  return target.tenant_id === actor.tenant_id && target.role !== 'admin' && target.app_role !== 'hq_admin';
}

export async function fetchAll(entity, filter, limit = 500) {
  const rows = []; let cursor = null;
  while (true) {
    const page = await entity.filter(cursor ? { ...filter, id: { $gt: cursor } } : filter, 'id', limit);
    if (!page.length) break;
    rows.push(...page); cursor = page.at(-1).id;
    if (page.length < limit) break;
  }
  return rows;
}

export function redactSensitive(value) {
  const forbidden = /password|token|secret|authorization|cookie|document|file_url|phone|email|tax_id|cpf|cnpj/i;
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, forbidden.test(key) ? '[REDACTED]' : redactSensitive(item)]));
  return value;
}