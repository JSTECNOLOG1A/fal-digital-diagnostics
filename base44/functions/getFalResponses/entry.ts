/**
 * getFalResponses
 * Lê FalResponses usando service role para permitir acesso cross-tenant.
 * Necessário para consultores admin verem respostas salvas por outros usuários/tenants.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';

  if (!user) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { assessment_id, dimension_key } = await req.json();

  if (!assessment_id) {
    return Response.json({ error: 'assessment_id é obrigatório' }, { status: 400 });
  }

  // Guard: validar propriedade do tenant (hq_admin pode ver cross-tenant)
  const assessment = await base44.asServiceRole.entities.Assessment.get(assessment_id);
  if (!assessment) return Response.json({ error: 'Assessment não encontrado' }, { status: 404 });
  if (appRole !== 'hq_admin' && assessment.tenant_id !== user.tenant_id) {
    return Response.json({ error: 'Forbidden: assessment não pertence ao seu tenant' }, { status: 403 });
  }

  const filter = { assessment_id };
  if (dimension_key) filter.dimension_key = dimension_key;

  const responses = await base44.asServiceRole.entities.FalResponse.filter(filter, 'dimension_key', 500);

  return Response.json({ responses });
});