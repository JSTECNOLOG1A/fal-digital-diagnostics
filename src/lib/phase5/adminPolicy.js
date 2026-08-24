export function canManageTenantAdministration(role, actorTenantId, requestedTenantId) {
  if (role === 'hq_admin') return Boolean(requestedTenantId);
  return role === 'tenant_admin' && actorTenantId === requestedTenantId;
}