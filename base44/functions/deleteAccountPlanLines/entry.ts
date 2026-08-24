/**
 * deleteAccountPlanLines
 * Deleta todas as linhas de um plano de contas de forma eficiente e segura.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

  const { account_plan_id, tenant_id } = await req.json();
  if (!account_plan_id || !tenant_id) {
    return Response.json({ error: 'account_plan_id e tenant_id são obrigatórios' }, { status: 400 });
  }

  // ── Role Guard: destructive operations require admin-level role (SEG-03)
  //    Aligns with rbac.js canDeleteEntity = isAdmin — consultant/client_viewer denied
  const ALLOWED_DELETE_ROLES = new Set(['hq_admin', 'tenant_admin']);
  if (!ALLOWED_DELETE_ROLES.has(appRole)) {
    return Response.json({ error: 'Permissão insuficiente para operação destrutiva' }, { status: 403 });
  }

  // ── Tenant Guard: non-HQ users can only operate on their own tenant ──
  if (!isHQ && tenant_id !== user.tenant_id) {
    return Response.json({ error: 'Acesso negado: tenant não autorizado' }, { status: 403 });
  }

  try {
    // Fetch todas as linhas
    const rawLines = await base44.asServiceRole.entities.FinancialAccountPlanLine.filter(
      { account_plan_id, tenant_id },
      'account_code',
      10000
    );
    
    const lines = Array.isArray(rawLines) ? rawLines : [];

    if (lines.length === 0) {
      // Log para debug
      console.error(`[deleteAccountPlanLines] Nenhuma linha encontrada para plan_id=${account_plan_id}, tenant_id=${tenant_id}`);
      return Response.json({ deleted: 0, failed: 0, total: 0, message: 'Nenhuma linha para deletar' });
    }

    // Deleta em lotes de 10 em paralelo com pequeno delay entre lotes
    const BATCH_SIZE = 10;
    let deleted = 0;
    let failed = 0;

    for (let i = 0; i < lines.length; i += BATCH_SIZE) {
      const batch = lines.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(l => base44.asServiceRole.entities.FinancialAccountPlanLine.delete(l.id))
      );

      results.forEach(r => {
        if (r.status === 'fulfilled') deleted++;
        else failed++;
      });

      // Pequeno delay entre lotes para evitar rate limit
      if (i + BATCH_SIZE < lines.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    return Response.json({
      success: true,
      deleted,
      failed,
      total: lines.length,
      message: `${deleted} linhas deletadas${failed > 0 ? `, ${failed} falharam` : ''}`,
    });
  } catch (err) {
    console.error('[deleteAccountPlanLines] ERROR:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});