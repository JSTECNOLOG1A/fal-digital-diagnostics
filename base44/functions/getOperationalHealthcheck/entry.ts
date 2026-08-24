import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveAppRole } from '../../shared/accessGovernance.ts';
import { buildHealthPayload } from '../../shared/healthContract.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const actor = await base44.auth.me();
    if (!actor) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['hq_admin', 'tenant_admin'].includes(resolveAppRole(actor) || '')) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const tenant = actor.tenant_id ? await base44.asServiceRole.entities.Tenant.get(actor.tenant_id).catch(() => null) : null;
    const services = { authentication: 'operational', database: tenant || resolveAppRole(actor) === 'hq_admin' ? 'operational' : 'degraded', storage: 'not_checked', integrations: 'not_checked' };
    return Response.json(buildHealthPayload(services));
  } catch (error) {
    return Response.json({ status: 'degraded', checked_at: new Date().toISOString(), error: 'Healthcheck indisponível' }, { status: 503 });
  }
});