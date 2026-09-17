/**
 * convertFinancialRecommendation
 * Converte uma FinancialRecommendation diretamente em ActionTask no plano de
 * ação central do grupo — mesma lógica do diagnóstico 8D (AddManualTaskModal),
 * onde a tarefa entra direto no plano do grupo sem seleção manual.
 *
 * CROSS-003 FIX: Tenant is derived from authoritative resources (recommendation
 * and diagnosis), NOT from the payload. Divergent tenant_ids between rec and
 * diagnosis return 409. Payload tenant_id that diverges from canonical returns 403.
 *
 * Recebe: financial_recommendation_id, financial_diagnosis_id, task_title, description, horizon,
 *         owner_name, priority, tenant_id, indicator_code, indicator_label
 * Resolve: diagnóstico financeiro → grupo → plano de ação (cria se não existir)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user: any): string | null {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

// SEG-03: Write guard — blocks client_viewer from mutations
const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
function assertCanWrite(appRole: string | null) {
  if (!WRITE_ROLES.has(appRole)) {
    throw Object.assign(new Error('Forbidden: write permission required'), { status: 403 });
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';

    // SEG-03: Write guard
    try { assertCanWrite(appRole); } catch (wErr: any) {
      return Response.json({ error: wErr.message }, { status: wErr.status || 403 });
    }

    const body = await req.json();
    const {
      financial_recommendation_id,
      financial_diagnosis_id,
      task_title,
      description,
      horizon = '90d',
      owner_name,
      priority,
      tenant_id,
      indicator_code,
      indicator_label,
    } = body;

    if (!task_title) {
      return Response.json({ error: 'task_title é obrigatório' }, { status: 400 });
    }

    // 1) Carrega a FinancialRecommendation (se informada) ou usa dados mínimos
    let rec: any = null;
    let diagId = financial_diagnosis_id;
    if (financial_recommendation_id) {
      rec = await base44.asServiceRole.entities.FinancialRecommendation.get(financial_recommendation_id);
      if (!rec) return Response.json({ error: 'Recomendação financeira não encontrada' }, { status: 404 });
      diagId = rec.financial_diagnosis_id || diagId;
    }
    if (!diagId) {
      return Response.json({ error: 'financial_recommendation_id ou financial_diagnosis_id é obrigatório' }, { status: 400 });
    }

    // 2) Resolve o diagnóstico financeiro
    const dx = await base44.asServiceRole.entities.FinancialDiagnosis.get(diagId);
    if (!dx) return Response.json({ error: 'Diagnóstico financeiro não encontrado' }, { status: 404 });

    // ── CROSS-003: Derive canonicalTenantId from authoritative resources ──
    const recTenantId = rec?.tenant_id || null;
    const diagTenantId = dx?.tenant_id || null;

    // Integrity check: if both rec and diagnosis have tenant_ids, they must match
    if (recTenantId && diagTenantId && recTenantId !== diagTenantId) {
      return Response.json(
        { error: 'Integridade inválida entre recomendação e diagnóstico' },
        { status: 409 }
      );
    }

    const canonicalTenantId = recTenantId || diagTenantId;
    if (!canonicalTenantId) {
      return Response.json(
        { error: 'Tenant do recurso não identificado' },
        { status: 422 }
      );
    }

    // Reject if payload tenant_id diverges from canonical
    if (tenant_id && tenant_id !== canonicalTenantId) {
      return Response.json(
        { error: 'Tenant informado diverge do recurso' },
        { status: 403 }
      );
    }

    // Validate user tenant against canonical
    if (!isHQ && user.tenant_id !== canonicalTenantId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3) Resolve grupo/empresa
    const groupId = dx.group_id || dx.company_id;
    if (!groupId) {
      return Response.json({ error: 'Diagnóstico financeiro sem grupo/empresa vinculado' }, { status: 400 });
    }

    // 4) Resolve (ou cria) o plano de ação central do grupo — using canonicalTenantId
    let candidates = await base44.asServiceRole.entities.ActionPlan.filter(
      { group_id: groupId, tenant_id: canonicalTenantId }, '-generated_at', 20
    );
    if (candidates.length === 0) {
      candidates = await base44.asServiceRole.entities.ActionPlan.filter(
        { target_type: 'group', target_id: groupId, tenant_id: canonicalTenantId }, '-generated_at', 20
      );
    }
    candidates.sort((a, b) => {
      const rank = (p: any) => (p.status === 'active' ? 0 : p.status === 'draft' ? 1 : 2);
      return rank(a) - rank(b);
    });

    let plan = candidates[0] || null;
    if (!plan) {
      // Cria plano vinculado ao assessment FAL do grupo, se existir
      const groupAssessments = await base44.asServiceRole.entities.Assessment.filter(
        { group_id: groupId, tenant_id: canonicalTenantId }, '-created_date', 10
      );
      plan = await base44.asServiceRole.entities.ActionPlan.create({
        tenant_id: canonicalTenantId,
        assessment_id: groupAssessments[0]?.id || null,
        group_id: groupId,
        target_type: 'group',
        target_id: groupId,
        status: 'draft',
        generated_at: new Date().toISOString(),
        generated_by: user.email,
      });
    }

    // 5) Calcula due_date
    const daysMap: Record<string, number> = { '30d': 30, '60d': 60, '90d': 90, '180d': 180 };
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (daysMap[horizon] || 90));

    // 6) Resolve indicador de origem
    let resolvedIndicatorCode = indicator_code || '';
    let resolvedIndicatorLabel = indicator_label || '';
    if (!resolvedIndicatorCode && rec?.related_indicator_codes?.length) {
      const realCode = rec.related_indicator_codes.find(
        (c: string) => typeof c === 'string' && !c.startsWith('__fk__:')
      );
      if (realCode) resolvedIndicatorCode = realCode;
    }
    if (!resolvedIndicatorLabel) {
      resolvedIndicatorLabel = resolvedIndicatorCode || 'Análise Financeira';
    }

    // 7) Cria a ActionTask — using canonicalTenantId
    const task = await base44.asServiceRole.entities.ActionTask.create({
      tenant_id: canonicalTenantId,
      plan_id: plan.id,
      assessment_id: plan.assessment_id || null,
      title: task_title,
      description: description || rec?.suggested_action || rec?.diagnostic_thesis || task_title,
      reason: rec?.diagnostic_thesis || rec?.probable_cause || '',
      owner_name: owner_name || '',
      priority: priority || 'medium',
      horizon,
      due_date: dueDate.toISOString().split('T')[0],
      status: 'todo',
      origin_type: 'manual',
      origin_detail: `Análise Financeira · ${resolvedIndicatorLabel}`,
      is_manual: true,
      is_system_generated: false,
      task_layer: 'strategic',
      dimension_key: 'analise_financeira',
      cluster_key: resolvedIndicatorLabel,
      task_key: `finrec::${rec?.id || 'manual'}::${Date.now()}`,
    });

    // 8) Marca a FinancialRecommendation como aprovada/consumida (se aplicável)
    if (rec) {
      await base44.asServiceRole.entities.FinancialRecommendation.update(financial_recommendation_id, {
        is_approved: true,
        approved_by: user.email,
        approved_at: new Date().toISOString(),
      }).catch(() => {});
    }

    // 9) Fecha o ciclo de rastreabilidade: marca o achado de origem (via tag
    // __fk__ em related_indicator_codes — mesmo mecanismo usado por
    // generateFinancialRecommendations, ver ali) e a FinancialActionProposal
    // correspondente como convertidos/exportados, com o id da tarefa criada.
    // Best-effort: falha aqui nunca deve impedir a tarefa já criada de ser
    // retornada ao usuário.
    if (rec) {
      const fkTag = (rec.related_indicator_codes || []).find(
        (c: unknown) => typeof c === 'string' && c.startsWith('__fk__:')
      );
      const findingKey = fkTag ? String(fkTag).replace('__fk__:', '') : null;
      if (findingKey) {
        try {
          const [finding] = await base44.asServiceRole.entities.FinancialFinding.filter(
            { finding_key: findingKey, financial_diagnosis_id: diagId }, 'id', 1
          );
          if (finding) {
            await base44.asServiceRole.entities.FinancialFinding.update(finding.id, {
              action_plan_status: 'converted_to_task',
              action_recommendation_id: financial_recommendation_id,
              action_task_id: task.id,
              action_plan_id: plan.id,
              converted_to_task_at: new Date().toISOString(),
              converted_to_task_by: user.email,
            });
          }
        } catch (e: any) {
          console.error('[convertFinancialRecommendation] falha ao marcar achado como convertido:', e.message);
        }
      }

      try {
        const [proposal] = await base44.asServiceRole.entities.FinancialActionProposal.filter(
          { financial_recommendation_id }, 'id', 1
        );
        if (proposal) {
          await base44.asServiceRole.entities.FinancialActionProposal.update(proposal.id, {
            status: 'exported',
            exported_to_fal: true,
            fal_action_plan_id: plan.id,
            fal_action_task_id: task.id,
            exported_at: new Date().toISOString(),
          });
        }
      } catch (e: any) {
        console.error('[convertFinancialRecommendation] falha ao marcar proposta como exportada:', e.message);
      }
    }

    return Response.json({ task, plan_id: plan.id });
  } catch (err: any) {
    // Distinguish error types for proper HTTP status
    if (err?.status === 403) {
      return Response.json({ error: err.message }, { status: 403 });
    }
    if (err?.status === 409) {
      return Response.json({ error: err.message }, { status: 409 });
    }
    return Response.json({ error: err.message }, { status: 500 });
  }
});