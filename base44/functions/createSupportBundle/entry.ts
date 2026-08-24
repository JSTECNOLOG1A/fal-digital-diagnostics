import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { redactSensitive, resolveAppRole } from '../../shared/accessGovernance.ts';
import { releaseMetadata } from '../../shared/releaseMetadata.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const actor = await base44.auth.me();
    if (!actor) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { correlation_id: correlationId = null, error_id: errorId = null, context = {} } = await req.json();
    const role = resolveAppRole(actor);
    const isAdmin = ['hq_admin', 'tenant_admin'].includes(role || '');
    let health = null;
    if (isAdmin) {
      const healthResponse = await base44.functions.invoke('getOperationalHealthcheck', {});
      health = healthResponse?.data || healthResponse;
    }
    const safeContext = redactSensitive({ route: context.route || null, version: context.version || releaseMetadata.version });
    const bundle = redactSensitive({ format: 'fal-support-bundle', created_at: new Date().toISOString(), version: releaseMetadata.version, build_sha: releaseMetadata.buildSha, correlation_id: correlationId || errorId, health: health ? { status: health.status, services: health.services } : null, context: safeContext });
    await base44.asServiceRole.entities.AuditLog.create({ tenant_id: actor.tenant_id || null, action: 'SUPPORT_BUNDLE_CREATED', actor_app_role: role, timestamp: new Date().toISOString(), correlation_id: correlationId || errorId, details: { contains_pii: false, route: safeContext.route, version: safeContext.version } });
    return Response.json({ bundle });
  } catch (error) {
    return Response.json({ error: 'Não foi possível gerar o support bundle.' }, { status: 500 });
  }
});