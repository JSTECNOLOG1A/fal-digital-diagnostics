/**
 * deduplicateActionPlanReviews
 * Função administrativa para tratar revisões duplicadas legadas.
 * - Cancela revisões draft duplicadas (mantém apenas a mais recente por plano)
 * - Renumera review_number sequencialmente por plano (concluídas + a draft válida)
 * - Nunca apaga registros — apenas cancela e renumera
 * 
 * Payload: { action_plan_id (opcional — se não enviado, processa todos os planos do tenant) }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (appRole !== 'hq_admin') return Response.json({ error: 'Forbidden: HQ admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { action_plan_id } = body;

    // ── SEG-02 Tenant Guard ──────────────────────────────────────────────────
    // When action_plan_id is provided, validate it belongs to user's tenant (non-HQ)
    let filter = { tenant_id: user.tenant_id };
    if (action_plan_id) {
      if (isHQ) {
        filter = { action_plan_id };
      } else {
        // Non-HQ admin: must verify the plan belongs to their tenant
        const plan = await base44.asServiceRole.entities.ActionPlan.get(action_plan_id);
        if (!plan) return Response.json({ error: 'Plan not found' }, { status: 404 });
          // SEG-03: Role guard — deny client_viewer from triggering mutations
          const WRITE_ROLES = ['hq_admin', 'tenant_admin', 'consultant'];
          if (!WRITE_ROLES.includes(appRole)) {
            return Response.json({ error: 'Forbidden: insufficient role' }, { status: 403 });
          }

        if (plan.tenant_id !== user.tenant_id) {
          return Response.json({ error: 'Forbidden: plan belongs to another tenant' }, { status: 403 });
        }
        filter = { action_plan_id, tenant_id: user.tenant_id };
      }
    }
    const allReviews = await base44.asServiceRole.entities.ActionPlanReview.filter(filter, 'review_number', 500);

    if (allReviews.length === 0) {
      return Response.json({ message: 'Nenhuma revisão encontrada', cancelled: 0, renumbered: 0 });
    }

    // Agrupar por action_plan_id
    const byPlan = {};
    for (const rev of allReviews) {
      if (!byPlan[rev.action_plan_id]) byPlan[rev.action_plan_id] = [];
      byPlan[rev.action_plan_id].push(rev);
    }

    let totalCancelled = 0;
    let totalRenumbered = 0;
    const report = [];

    for (const [planId, reviews] of Object.entries(byPlan)) {
      // Separar por status
      const drafts = reviews.filter(r => r.status === 'draft')
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date)); // mais recente primeiro
      const completed = reviews.filter(r => r.status === 'completed')
        .sort((a, b) => new Date(a.review_date) - new Date(b.review_date));
      const cancelled = reviews.filter(r => r.status === 'cancelled');

      // Cancelar drafts extras (manter apenas o mais recente)
      const [validDraft, ...extraDrafts] = drafts;
      for (const dup of extraDrafts) {
        await base44.asServiceRole.entities.ActionPlanReview.update(dup.id, { status: 'cancelled' });
        totalCancelled++;
      }

      // Renumerar: completed em ordem cronológica, depois validDraft por último
      const toRenumber = [...completed, ...(validDraft ? [validDraft] : [])];
      let num = 1;
      for (const rev of toRenumber) {
        if (rev.review_number !== num) {
          await base44.asServiceRole.entities.ActionPlanReview.update(rev.id, { review_number: num });
          totalRenumbered++;
        }
        num++;
      }

      report.push({
        plan_id: planId,
        extra_drafts_cancelled: extraDrafts.length,
        valid_draft: validDraft?.id || null,
        completed_count: completed.length,
        renumbered: toRenumber.length,
      });
    }

    return Response.json({
      message: `Deduplicação concluída. ${totalCancelled} draft(s) cancelado(s), ${totalRenumbered} revisão(ões) renumerada(s).`,
      plans_processed: Object.keys(byPlan).length,
      total_cancelled: totalCancelled,
      total_renumbered: totalRenumbered,
      report,
    });

  } catch (err) {
    console.error('Erro em deduplicateActionPlanReviews:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});