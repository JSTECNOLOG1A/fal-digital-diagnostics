/**
 * sendFindingToActionPlan
 * Envia um FinancialFinding para o plano de ação como ActionRecommendation pendente.
 *
 * Fluxo: FinancialFinding → ActionRecommendation (source_type=financial_diagnostic)
 * O ActionTask NÃO é criado aqui — apenas a recomendação pendente.
 * A conversão em tarefa é feita via manageActionRecommendation (action=convert).
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

// SEG-03: Write guard — blocks client_viewer from mutations
const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
function assertCanWrite(appRole) {
  if (!WRITE_ROLES.has(appRole)) {
    throw Object.assign(new Error('Forbidden: write permission required'), { status: 403 });
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // SEG-03: Write guard
    try { assertCanWrite(appRole); } catch (wErr) {
      return Response.json({ error: wErr.message }, { status: wErr.status || 403 });
    }

    const body = await req.json();
    const { finding_id, action_plan_id, assessment_id } = body;

    if (!finding_id) return Response.json({ error: 'finding_id é obrigatório' }, { status: 400 });
    if (!action_plan_id) return Response.json({ error: 'action_plan_id é obrigatório' }, { status: 400 });

    // Carregar achado
    const finding = await base44.asServiceRole.entities.FinancialFinding.get(finding_id);
    if (!finding) return Response.json({ error: 'FinancialFinding não encontrado' }, { status: 404 });

    // Guard de tenant
    if (!isHQ && finding.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validar plano
    const plan = await base44.asServiceRole.entities.ActionPlan.get(action_plan_id);
    if (!plan) return Response.json({ error: 'ActionPlan não encontrado' }, { status: 404 });
    if (!isHQ && plan.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden: plano pertence a outro tenant' }, { status: 403 });
    }

    // Evitar duplicata — verificar se já foi enviado
    if (finding.action_plan_status && finding.action_plan_status !== 'not_sent') {
      return Response.json({
        error: `Achado já foi enviado ao plano (status: ${finding.action_plan_status})`,
        action_recommendation_id: finding.action_recommendation_id,
      }, { status: 409 });
    }

    // Criar ActionRecommendation
    const priority = finding.severity === 'critical' ? 'critical'
      : finding.severity === 'high' ? 'high'
      : finding.severity === 'medium' ? 'medium' : 'low';

    const rec = await base44.asServiceRole.entities.ActionRecommendation.create({
      tenant_id: finding.tenant_id,
      assessment_id: assessment_id || plan.assessment_id,
      action_plan_id,
      financial_diagnosis_id: finding.financial_diagnosis_id,
      financial_finding_id: finding_id,
      source_type: 'financial_diagnostic',
      title: finding.title,
      recommendation_text: finding.description || finding.title,
      rationale: `Achado financeiro identificado no diagnóstico financeiro. Indicador: ${finding.financial_indicator || '—'}. Período: ${finding.period || '—'}.`,
      priority,
      status: 'needs_classification',
      created_by: user.email,
    });

    // Atualizar FinancialFinding
    await base44.asServiceRole.entities.FinancialFinding.update(finding_id, {
      action_plan_status: 'needs_classification',
      action_recommendation_id: rec.id,
      action_plan_id,
      sent_to_action_plan_at: new Date().toISOString(),
      sent_to_action_plan_by: user.email,
    });

    return Response.json({ recommendation: rec, finding_updated: true });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});