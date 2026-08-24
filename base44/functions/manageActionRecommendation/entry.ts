/**
 * manageActionRecommendation
 * Backend centralizado para operações sensíveis de ActionRecommendation.
 *
 * action: 
 *   "approve"      — aprova recomendação
 *   "reject"       — rejeita com motivo
 *   "convert"      — converte em ActionTask (atualiza FinancialFinding se aplicável)
 *   "improve_ai"   — melhora texto com IA (não cria tarefa, retorna sugestão)
 *   "suggest_library" — sugere entrada para ActionRecommendationLibrary
 *   "create_manual"   — cria recomendação manual do consultor
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
    const { action } = body;

    // ── CREATE MANUAL ──────────────────────────────────────────────────────────
    if (action === 'create_manual') {
      const { recommendation_data } = body;
      if (!recommendation_data?.title || !recommendation_data?.recommendation_text) {
        return Response.json({ error: 'title e recommendation_text são obrigatórios' }, { status: 400 });
      }
      if (!recommendation_data?.tenant_id) {
        return Response.json({ error: 'tenant_id é obrigatório' }, { status: 400 });
      }
      if (!isHQ && recommendation_data.tenant_id !== user.tenant_id) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }

      const rec = await base44.asServiceRole.entities.ActionRecommendation.create({
        ...recommendation_data,
        source_type: 'manual',
        status: 'needs_classification',
        created_by: user.email,
      });
      return Response.json({ recommendation: rec });
    }

    // ── LINK CLUSTER ────────────────────────────────────────────────────────────
    if (action === 'link_cluster') {
      const { recommendation_id: linkRecId, cluster_key, subdimension_key } = body;
      if (!linkRecId || !cluster_key) return Response.json({ error: 'recommendation_id e cluster_key são obrigatórios' }, { status: 400 });
      const linkRec = await base44.asServiceRole.entities.ActionRecommendation.get(linkRecId);
      if (!linkRec) return Response.json({ error: 'Recomendação não encontrada' }, { status: 404 });
      if (!isHQ && linkRec.tenant_id !== user.tenant_id) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const updated = await base44.asServiceRole.entities.ActionRecommendation.update(linkRecId, { cluster_key, subdimension_key: subdimension_key || null });
      return Response.json({ recommendation: updated });
    }

    // ── EDIT ────────────────────────────────────────────────────────────────────
    if (action === 'edit') {
      const { recommendation_id: edit_rec_id, edit_data } = body;
      if (!edit_rec_id) return Response.json({ error: 'recommendation_id é obrigatório' }, { status: 400 });
      if (!edit_data) return Response.json({ error: 'edit_data é obrigatório' }, { status: 400 });
      const editRec = await base44.asServiceRole.entities.ActionRecommendation.get(edit_rec_id);
      if (!editRec) return Response.json({ error: 'Recomendação não encontrada' }, { status: 404 });
      if (!isHQ && editRec.tenant_id && editRec.tenant_id !== user.tenant_id) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (editRec.status === 'converted_to_tasks') {
        return Response.json({ error: 'Não é possível editar recomendação já convertida em tarefa' }, { status: 400 });
      }
      // Filtrar apenas campos permitidos para edição de texto
      const allowed = ['title', 'recommendation_text', 'rationale', 'practical_steps',
        'evidence_required', 'expected_result', 'suggested_owner_area', 'priority',
        'impact_score', 'effort_score'];
      const sanitized = {};
      for (const k of allowed) {
        if (edit_data[k] !== undefined) sanitized[k] = edit_data[k];
      }
      const updated = await base44.asServiceRole.entities.ActionRecommendation.update(edit_rec_id, sanitized);
      return Response.json({ recommendation: updated });
    }

    // Para as demais ações, carrega a recomendação existente
    const { recommendation_id } = body;
    if (!recommendation_id) return Response.json({ error: 'recommendation_id é obrigatório' }, { status: 400 });

    const rec = await base44.asServiceRole.entities.ActionRecommendation.get(recommendation_id);
    if (!rec) return Response.json({ error: 'Recomendação não encontrada' }, { status: 404 });

    // Guard de tenant
    if (!isHQ && rec.tenant_id && rec.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden: recomendação pertence a outro tenant' }, { status: 403 });
    }

    // ── APPROVE ────────────────────────────────────────────────────────────────
    if (action === 'approve') {
      if (!['suggested', 'needs_classification'].includes(rec.status)) {
        return Response.json({ error: `Não é possível aprovar recomendação com status "${rec.status}"` }, { status: 400 });
      }
      const updated = await base44.asServiceRole.entities.ActionRecommendation.update(recommendation_id, {
        status: 'approved',
        approved_by: user.email,
        approved_at: new Date().toISOString(),
      });
      return Response.json({ recommendation: updated });
    }

    // ── REJECT ─────────────────────────────────────────────────────────────────
    if (action === 'reject') {
      const { rejected_reason } = body;
      if (['converted_to_tasks', 'rejected', 'cancelled'].includes(rec.status)) {
        return Response.json({ error: `Não é possível rejeitar recomendação com status "${rec.status}"` }, { status: 400 });
      }
      const updated = await base44.asServiceRole.entities.ActionRecommendation.update(recommendation_id, {
        status: 'rejected',
        rejected_reason: rejected_reason || '',
      });
      return Response.json({ recommendation: updated });
    }

    // ── CONVERT TO TASK ────────────────────────────────────────────────────────
    if (action === 'convert') {
      const { plan_id, task_title, description, horizon = '90d', owner_name, priority, evidence_required, expected_result, tenant_id } = body;

      if (!['suggested', 'approved', 'needs_classification'].includes(rec.status)) {
        return Response.json({ error: `Recomendação com status "${rec.status}" não pode ser convertida` }, { status: 400 });
      }
      if (rec.converted_task_ids?.length > 0) {
        return Response.json({ error: 'Recomendação já foi convertida em tarefa' }, { status: 400 });
      }
      if (!plan_id) return Response.json({ error: 'plan_id é obrigatório' }, { status: 400 });
      if (!task_title) return Response.json({ error: 'task_title é obrigatório' }, { status: 400 });

      // ── Resolução automática do plano de ação único do grupo ──────────────────
      // O vínculo é automático: não exige seleção manual. Se plan_id não vier,
      // resolvemos (ou criamos) o plano central do grupo a partir do diagnóstico
      // financeiro vinculado à recomendação.
      let resolvedPlanId = plan_id;
      let plan = resolvedPlanId
        ? await base44.asServiceRole.entities.ActionPlan.get(resolvedPlanId)
        : null;

      if (!plan && rec.financial_diagnosis_id) {
        const dx = await base44.asServiceRole.entities.FinancialDiagnosis.get(rec.financial_diagnosis_id);
        const groupId = dx?.group_id;
        if (groupId) {
          let candidates = await base44.asServiceRole.entities.ActionPlan.filter(
            { group_id: groupId, tenant_id: rec.tenant_id }, "-generated_at", 20
          );
          if (candidates.length === 0) {
            candidates = await base44.asServiceRole.entities.ActionPlan.filter(
              { target_type: "group", target_id: groupId, tenant_id: rec.tenant_id }, "-generated_at", 20
            );
          }
          candidates.sort((a, b) => {
            const rank = (p) => (p.status === "active" ? 0 : p.status === "draft" ? 1 : 2);
            return rank(a) - rank(b);
          });
          if (candidates.length > 0) {
            plan = candidates[0];
            resolvedPlanId = plan.id;
          } else {
            const groupAssessments = await base44.asServiceRole.entities.Assessment.filter(
              { group_id: groupId, tenant_id: rec.tenant_id }, "-created_date", 10
            );
            if (groupAssessments.length === 0) {
              return Response.json({
                error: "Não há plano de ação nem diagnóstico FAL para o grupo. Gere um diagnóstico FAL e o plano de ação do grupo antes de converter achados financeiros em tarefas.",
              }, { status: 400 });
            }
            plan = await base44.asServiceRole.entities.ActionPlan.create({
              tenant_id: rec.tenant_id,
              assessment_id: groupAssessments[0].id,
              group_id: groupId,
              target_type: "group",
              target_id: groupId,
              status: "draft",
              generated_at: new Date().toISOString(),
              generated_by: user.email,
            });
            resolvedPlanId = plan.id;
          }
        }
      }

      if (!plan) return Response.json({ error: 'ActionPlan não encontrado e não foi possível resolver automaticamente o plano do grupo.' }, { status: 404 });
      if (!isHQ && plan.tenant_id !== user.tenant_id) {
        return Response.json({ error: 'Forbidden: plano pertence a outro tenant' }, { status: 403 });
      }

      // Calcular due_date
      const daysMap = { '30d': 30, '60d': 60, '90d': 90, '180d': 180 };
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (daysMap[horizon] || 90));

      // Criar ActionTask com rastreabilidade completa
      // Usa resolvedPlanId (plano único do grupo resolvido acima), não plan_id do body
      const task = await base44.asServiceRole.entities.ActionTask.create({
        tenant_id: rec.tenant_id,
        plan_id: resolvedPlanId,
        assessment_id: rec.assessment_id || plan.assessment_id,
        title: task_title,
        description: description || rec.recommendation_text,
        how_to_execute: rec.practical_steps,
        expected_evidence: evidence_required || rec.evidence_required,
        reason: rec.rationale,
        owner_name: owner_name || rec.suggested_owner_area || '',
        typical_owner: rec.suggested_owner_area,
        priority: priority || rec.priority || 'medium',
        horizon,
        due_date: dueDate.toISOString().split('T')[0],
        impact_score: rec.impact_score,
        effort_score: rec.effort_score,
        dimension_key: rec.dimension_key,
        subdimension_key: rec.subdimension_key,
        cluster_key: rec.cluster_key,
        status: 'todo',
        origin_type: rec.source_type === 'manual' ? 'manual' : 'cluster',
        is_manual: rec.source_type === 'manual',
        is_system_generated: false,
        task_layer: 'strategic',
      });

      // Atualizar ActionRecommendation
      const existingIds = rec.converted_task_ids || [];
      await base44.asServiceRole.entities.ActionRecommendation.update(recommendation_id, {
        status: 'converted_to_tasks',
        converted_task_ids: [...existingIds, task.id],
        converted_by: user.email,
        converted_at: new Date().toISOString(),
      });

      // Atualizar FinancialFinding se origem financeira
      if (rec.financial_finding_id && rec.source_type === 'financial_diagnostic') {
        await base44.asServiceRole.entities.FinancialFinding.update(rec.financial_finding_id, {
          action_plan_status: 'converted_to_task',
          action_task_id: task.id,
          converted_to_task_at: new Date().toISOString(),
          converted_to_task_by: user.email,
        }).catch(() => {}); // best-effort
      }

      return Response.json({ task, recommendation_updated: true });
    }

    // ── IMPROVE WITH AI ────────────────────────────────────────────────────────
    if (action === 'improve_ai') {
      const DIM_LABELS = {
        governanca: 'Governança', juridico: 'Jurídico', controles_internos: 'Controles Internos',
        financeiro: 'Financeiro', contabil: 'Contábil', tributario: 'Fiscal',
        operacional: 'Operacional', sistemas: 'Tecnologia',
      };

      const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Você é um consultor sênior do Método FAL. Melhore a seguinte recomendação técnica, tornando-a mais específica, prática e acionável.
Título: ${rec.title}
Texto atual: ${rec.recommendation_text}
Dimensão: ${DIM_LABELS[rec.dimension_key] || rec.dimension_key || 'não especificada'}
Passos atuais: ${rec.practical_steps || 'não definidos'}

Retorne JSON com: improved_text (string), improved_steps (string), improved_evidence (string).
Mantenha o mesmo tom técnico consultivo. Seja específico e prático.`,
        response_json_schema: {
          type: 'object',
          properties: {
            improved_text:     { type: 'string' },
            improved_steps:    { type: 'string' },
            improved_evidence: { type: 'string' },
          }
        }
      });

      if (!aiResult?.improved_text) {
        return Response.json({ error: 'IA não retornou resultado válido' }, { status: 500 });
      }

      return Response.json({
        improved_text:     aiResult.improved_text,
        improved_steps:    aiResult.improved_steps || rec.practical_steps,
        improved_evidence: aiResult.improved_evidence || rec.evidence_required,
        source: 'ai',
      });
    }

    // ── SUGGEST TO LIBRARY ─────────────────────────────────────────────────────
    if (action === 'suggest_library') {
      if (!rec.dimension_key || !rec.title) {
        return Response.json({ error: 'Recomendação precisa de dimension_key e title para sugerir à biblioteca' }, { status: 400 });
      }

      const entry = await base44.asServiceRole.entities.ActionRecommendationLibrary.create({
        tenant_id: rec.tenant_id,
        dimension_key: rec.dimension_key,
        subdimension_key: rec.subdimension_key,
        cluster_key: rec.cluster_key,
        recommendation_title: rec.title,
        recommendation_text: rec.recommendation_text,
        rationale: rec.rationale,
        practical_steps: rec.practical_steps,
        evidence_required: rec.evidence_required,
        expected_result: rec.expected_result,
        suggested_owner_area: rec.suggested_owner_area,
        impact_score: rec.impact_score,
        effort_score: rec.effort_score,
        complexity_level: rec.complexity_level,
        is_active: true,
        is_draft: true, // pendente de aprovação
        suggested_by: user.email,
        created_by: user.email,
      });

      await base44.asServiceRole.entities.ActionRecommendation.update(recommendation_id, {
        suggest_to_library: true,
        library_entry_id: entry.id,
      });

      return Response.json({ library_entry: entry });
    }

    return Response.json({ error: `action inválida: ${action}` }, { status: 400 });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});