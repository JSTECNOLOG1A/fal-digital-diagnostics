/**
 * generateAssessmentReportVersion
 * Pipeline de geração de relatório versionado.
 * 
 * REGRAS CRÍTICAS:
 * - Nunca sobrescreve versão anterior — sempre cria novo AssessmentReportVersion
 * - Salva payload_snapshot com todos os dados usados na geração
 * - Salva report_parameters com todos os parâmetros do usuário
 * - Compatível com ActionTask.plan_id (campo canônico) e status "done"/"completed"
 * - Valida guards antes de gerar (snapshot existe, revisão concluída, etc.)
 * 
 * COMPATIBILIDADE:
 * - ActionTask usa plan_id (não action_plan_id) — resolvido por getTaskPlanId()
 * - Status "done" = "completed" — resolvido por COMPLETED_STATUSES
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  return value;
}
async function sha256(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(value)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, '0')).join('');
}

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

// ── Compatibilidade ────────────────────────────────────────────
const REPORT_RENDERER_VERSION = 'FAL-RPT-2.46';
const COMPLETED_STATUSES = ['done', 'completed'];
const isTaskCompleted = (t) => COMPLETED_STATUSES.includes(t?.status);
const isTaskActive = (t) => t?.status !== 'cancelled';
const getTaskPlanId = (t) => t?.plan_id || t?.action_plan_id;

// ── Gera código legível único ──────────────────────────────────
function generateReportCode(reportType, versionNumber) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const typeCode = {
    initial_diagnostic:     'DIA',
    approved_action_plan:   'PAP',
    review_cycle:           'REV',
    consolidated_evolution: 'EVO',
    executive_summary:      'EXE',
    action_scope:           'ESC',
    financial_diagnostic:   'FIN',
    synthetic_integrated:   'SIN',
    custom:                 'CUS',
  }[reportType] || 'RPT';
  return `${typeCode}-${y}${m}-v${versionNumber}`;
}

// ── Guards de pré-validação ────────────────────────────────────
async function validateGuards(base44, params, assessment) {
  const { report_type, action_plan_review_id, diagnostic_link_id } = params;

  // Diagnóstico: exige snapshot
  if (['initial_diagnostic', 'executive_summary', 'consolidated_evolution'].includes(report_type)) {
    const snaps = await base44.asServiceRole.entities.FalDiagnosticSnapshot.filter(
      { assessment_id: assessment.id }, '-computed_at', 1
    );
    if (!snaps[0]) return { ok: false, error: 'Nenhum snapshot de diagnóstico encontrado. Execute o diagnóstico antes de gerar o relatório.' };
  }

  // Plano de ação: exige plano e tarefas
  if (['approved_action_plan', 'review_cycle', 'consolidated_evolution'].includes(report_type)) {
    const plans = await base44.asServiceRole.entities.ActionPlan.filter(
      { assessment_id: assessment.id }, '-created_date', 1
    );
    if (!plans[0]) return { ok: false, error: 'Nenhum plano de ação encontrado. Gere o plano de ação antes de emitir este relatório.' };
    const tasks = await base44.asServiceRole.entities.ActionTask.filter(
      { plan_id: plans[0].id }, 'created_date', 1
    );
    if (!tasks[0]) return { ok: false, error: 'Plano de ação sem tarefas. Gere as tarefas antes de emitir o relatório.' };
  }

  // Revisão: exige ActionPlanReview concluída
  if (report_type === 'review_cycle' && action_plan_review_id) {
    const review = await base44.asServiceRole.entities.ActionPlanReview.get(action_plan_review_id);
    if (!review) return { ok: false, error: 'Revisão não encontrada.' };
    if (review.status !== 'completed') return { ok: false, error: 'Apenas revisões concluídas podem gerar relatório. Conclua a revisão antes.' };
  }

  // Síntese integrada: exige DiagnosticLink ativo, válido para este assessment/tenant, e SyntheticDiagnosticSnapshot
  if (report_type === 'synthetic_integrated') {
    if (!diagnostic_link_id) return { ok: false, error: 'diagnostic_link_id obrigatório para relatório de síntese integrada.' };
    const link = await base44.asServiceRole.entities.DiagnosticLink.get(diagnostic_link_id).catch(() => null);
    if (!link) return { ok: false, error: 'Vínculo diagnóstico não encontrado.' };
    if (link.status !== 'active') return { ok: false, error: 'Vínculo inativo. Reative o vínculo antes de gerar o relatório.' };
    // Guard: vínculo deve pertencer ao mesmo assessment e tenant
    if (link.fal_assessment_id !== assessment.id) {
      return { ok: false, error: 'O vínculo informado não pertence a este assessment FAL.' };
    }
    if (link.tenant_id !== assessment.tenant_id) {
      return { ok: false, error: 'O vínculo informado pertence a outro tenant.' };
    }
    const snaps = await base44.asServiceRole.entities.SyntheticDiagnosticSnapshot.filter(
      { diagnostic_link_id, tenant_id: assessment.tenant_id }, '-generated_at', 1
    );
    if (!snaps[0]) return { ok: false, error: 'Nenhuma síntese integrada encontrada. Gere a síntese antes de emitir o relatório.' };
  }

  return { ok: true };
}

// ── Montagem do payload_snapshot ──────────────────────────────
async function buildPayloadSnapshot(base44, assessment, params) {
  const snapshot = {};

  // Assessment base
  snapshot.assessment = {
    id: assessment.id,
    title: assessment.title,
    tenant_id: assessment.tenant_id,
    status: assessment.status,
    target_type: assessment.target_type,
    target_id: assessment.target_id,
    group_id: assessment.group_id,
    company_id: assessment.company_id,
    unit_id: assessment.unit_id,
    active_dimensions: assessment.active_dimensions,
    competence: assessment.competence,
    diagnostic_cycle: assessment.diagnostic_cycle,
  };

  // Snapshot de diagnóstico
  const diagSnaps = await base44.asServiceRole.entities.FalDiagnosticSnapshot.filter(
    { assessment_id: assessment.id }, '-computed_at', 1
  );
  if (diagSnaps[0]) {
    snapshot.diagnostic_snapshot = {
      id: diagSnaps[0].id,
      overall_score: diagSnaps[0].overall_score,
      overall_level: diagSnaps[0].overall_level,
      dimension_scores: diagSnaps[0].dimension_scores,
      computed_at: diagSnaps[0].computed_at,
      ifme_final: diagSnaps[0].ifme_final,
      ifme_classification: diagSnaps[0].ifme_classification,
      alerts: diagSnaps[0].alerts,
    };
  }

  // Plano de ação + tarefas
  const plans = await base44.asServiceRole.entities.ActionPlan.filter(
    { assessment_id: assessment.id }, '-created_date', 1
  );
  if (plans[0]) {
    snapshot.action_plan = {
      id: plans[0].id,
      status: plans[0].status,
      overall_progress_percentage: plans[0].overall_progress_percentage,
      baseline_diagnostic_score: plans[0].baseline_diagnostic_score,
      generated_at: plans[0].generated_at,
    };

    // Tarefas — usando plan_id (campo canônico)
    const tasks = await base44.asServiceRole.entities.ActionTask.filter(
      { plan_id: plans[0].id }, '-priority_score', 300
    );
    snapshot.tasks = tasks.map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
      // Normaliza done→completed no payload do relatório sem alterar o banco
      status_normalized: COMPLETED_STATUSES.includes(t.status) ? 'completed' : t.status,
      priority: t.priority,
      dimension_key: t.dimension_key,
      due_date: t.due_date,
      owner_name: t.owner_name,
      progress_percentage: t.progress_percentage,
      horizon: t.horizon,
      action_type: t.action_type,
      task_layer: t.task_layer,
      is_completed: isTaskCompleted(t),
      is_active: isTaskActive(t),
      plan_id: getTaskPlanId(t), // campo canônico resolvido
    }));

    // KPIs do plano (usando COMPLETED_STATUSES para compatibilidade)
    const activeTasks = tasks.filter(isTaskActive);
    const doneTasks = tasks.filter(isTaskCompleted);
    snapshot.plan_kpis = {
      total: tasks.length,
      active: activeTasks.length,
      completed: doneTasks.length,
      todo: activeTasks.filter(t => t.status === 'todo').length,
      in_progress: activeTasks.filter(t => t.status === 'in_progress').length,
      blocked: activeTasks.filter(t => t.status === 'blocked').length,
      cancelled: tasks.filter(t => t.status === 'cancelled').length,
      progress_pct: activeTasks.length > 0 ? Math.round((doneTasks.length / activeTasks.length) * 100) : 0,
      critical_open: activeTasks.filter(t => t.priority === 'critical' && !isTaskCompleted(t)).length,
    };
  }

  // Revisões
  if (plans[0]) {
    const reviews = await base44.asServiceRole.entities.ActionPlanReview.filter(
      { action_plan_id: plans[0].id }, 'review_number', 50
    );
    snapshot.reviews = reviews.map(r => ({
      id: r.id,
      review_number: r.review_number,
      review_date: r.review_date,
      visit_type: r.visit_type,
      status: r.status,
      consultant_name: r.consultant_name,
      overall_progress_before: r.overall_progress_before,
      overall_progress_after: r.overall_progress_after,
      key_advances: r.key_advances,
      key_delays: r.key_delays,
      new_risks: r.new_risks,
      next_steps: r.next_steps,
      executive_summary: r.executive_summary,
      completed_at: r.completed_at,
    }));

    // TaskReviews da revisão específica, se informada
    if (params.action_plan_review_id) {
      const taskReviews = await base44.asServiceRole.entities.ActionTaskReview.filter(
        { action_plan_review_id: params.action_plan_review_id }, 'created_date', 200
      );
      snapshot.task_reviews = taskReviews;
    }
  }

  // Prioridades (se existir)
  const priSnaps = await base44.asServiceRole.entities.FalInsightSnapshot.filter(
    { assessment_id: assessment.id }, '-computed_at', 1
  ).catch(() => []);
  if (priSnaps[0]) {
    snapshot.priority_snapshot = {
      id: priSnaps[0].id,
      top_priorities: priSnaps[0].top_priorities,
      computed_at: priSnaps[0].computed_at,
    };
  }

  // Síntese integrada — se existir DiagnosticLink associado
  if (params.diagnostic_link_id) {
    const synthSnaps = await base44.asServiceRole.entities.SyntheticDiagnosticSnapshot.filter(
      { diagnostic_link_id: params.diagnostic_link_id }, '-generated_at', 1
    ).catch(() => []);
    if (synthSnaps[0]) {
      snapshot.synthetic_snapshot = {
        id: synthSnaps[0].id,
        synthetic_risk_level: synthSnaps[0].synthetic_risk_level,
        integrated_summary: synthSnaps[0].integrated_summary,
        maturity_summary: synthSnaps[0].maturity_summary,
        financial_summary: synthSnaps[0].financial_summary,
        correlations: synthSnaps[0].correlations,
        contradictions: synthSnaps[0].contradictions,
        recommendations: synthSnaps[0].recommendations,
        generated_at: synthSnaps[0].generated_at,
      };
    }
  }

  return snapshot;
}

// SEG-03: Write guard — blocks client_viewer from mutations
const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
function assertCanWrite(appRole) {
  if (!WRITE_ROLES.has(appRole)) {
    throw Object.assign(new Error('Forbidden: write permission required'), { status: 403 });
  }
}

// ── Handler principal ──────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // SEG-03: Write guard
    try { assertCanWrite(appRole); } catch (wErr) {
      return Response.json({ error: wErr.message }, { status: wErr.status || 403 });
    }

    const {
      assessment_id,
      report_type,
      report_title,
      preset_id,
      report_parameters = {},
      action_plan_review_id,
      diagnostic_link_id,
    } = body;

    // Validação básica
    if (!assessment_id) return Response.json({ error: 'assessment_id é obrigatório' }, { status: 400 });
    if (!report_type)   return Response.json({ error: 'report_type é obrigatório' }, { status: 400 });
    if (!report_title)  return Response.json({ error: 'report_title é obrigatório' }, { status: 400 });

    const validTypes = ['initial_diagnostic','approved_action_plan','review_cycle','consolidated_evolution','executive_summary','action_scope','financial_diagnostic','synthetic_integrated','custom'];
    if (!validTypes.includes(report_type)) {
      return Response.json({ error: `report_type inválido: ${report_type}` }, { status: 400 });
    }

    // Carregar assessment com validação de tenant
    const assessment = await base44.entities.Assessment.get(assessment_id);
    if (!assessment) return Response.json({ error: 'Assessment não encontrado' }, { status: 404 });

    if (!isHQ && assessment.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden: assessment pertence a outro tenant' }, { status: 403 });
    }

    // Guards metodológicos
    const guardResult = await validateGuards(base44, { report_type, action_plan_review_id, diagnostic_link_id }, assessment);
    if (!guardResult.ok) return Response.json({ error: guardResult.error }, { status: 422 });

    // Calcular próximo número de versão (nunca sobrescreve)
    const existingVersions = await base44.asServiceRole.entities.AssessmentReportVersion.filter(
      { assessment_id, report_type, tenant_id: assessment.tenant_id }, '-report_version_number', 500
    );

    // Montar payload_snapshot completo e imutável antes de decidir o reuso
    const payload_snapshot = await buildPayloadSnapshot(base44, assessment, { report_type, action_plan_review_id, diagnostic_link_id });
    const contentParameters = { report_title, preset_id: preset_id || null, audience: report_parameters.audience || null, notes: report_parameters.notes || null, selected_sections: report_parameters.selected_sections || null, action_plan_review_id: action_plan_review_id || null, diagnostic_link_id: diagnostic_link_id || null };
    const operationalParameters = { mark_as_official: Boolean(report_parameters.mark_as_official) };
    const content_parameters_hash = await sha256(contentParameters);
    const payload_checksum = await sha256({ payload_content_snapshot: payload_snapshot, contentParameters, report_type, renderer_version: REPORT_RENDERER_VERSION, method_version: assessment.method_version_id || null });
    const reused = existingVersions.find((version) => version.payload_checksum === payload_checksum && version.status !== 'failed');
    if (reused) return Response.json({ report_version_id: reused.id, report_code: reused.report_code, report_version_number: reused.report_version_number, status: reused.status, reused: true, operational_parameters: operationalParameters });
    const nextVersion = (existingVersions[0]?.report_version_number || 0) + 1;
    const reportCode = generateReportCode(report_type, nextVersion);
    const source_manifest = { diagnostic_snapshot: { id: payload_snapshot.diagnostic_snapshot?.id || null, checksum: await sha256(payload_snapshot.diagnostic_snapshot || null) }, insight_snapshot: { id: payload_snapshot.priority_snapshot?.id || null, checksum: await sha256(payload_snapshot.priority_snapshot || null) }, action_plan: { id: payload_snapshot.action_plan?.id || null, fingerprint: payload_snapshot.action_plan?.generation_fingerprint || null, updated_at: payload_snapshot.action_plan?.updated_at || null }, review: { id: action_plan_review_id || null, review_number: (payload_snapshot.reviews || []).find((item) => item.id === action_plan_review_id)?.review_number || null, closing_snapshot_checksum: await sha256((payload_snapshot.reviews || []).find((item) => item.id === action_plan_review_id)?.closing_snapshot || null) }, task_versions: (payload_snapshot.tasks || []).map((task) => ({ id: task.id, updated_at: task.updated_date || null })), financial_snapshots: payload_snapshot.financial_snapshots || [], method_version: assessment.method_version_id || null, renderer_version: REPORT_RENDERER_VERSION, content_parameters_hash, cutoff_at: new Date().toISOString() };

    // Criar registro de versão
    const reportVersion = await base44.asServiceRole.entities.AssessmentReportVersion.create({
      assessment_id,
      tenant_id: assessment.tenant_id,
      report_type,
      report_title,
      report_version_number: nextVersion,
      report_code: reportCode,
      status: 'generated',
      mark_as_official: false,
      preset_id: preset_id || null,
      action_plan_review_id: action_plan_review_id || null,
      assessment_revision_number: payload_snapshot.reviews?.length || null,
      report_parameters: {
        ...contentParameters,
        _operational_parameters: operationalParameters,
        // Metadados da emissão
        _generated_by: user.email,
        _generated_at: new Date().toISOString(),
        _preset_id: preset_id,
        _assessment_id: assessment_id,
      },
      payload_snapshot,
      payload_checksum,
      source_manifest,
      previous_report_version_id: existingVersions[0]?.id || null,
      action_plan_id: payload_snapshot.action_plan?.id || null,
      review_id: action_plan_review_id || null,
      diagnostic_snapshot_id: payload_snapshot.diagnostic_snapshot?.id || null,
      priority_snapshot_id: payload_snapshot.priority_snapshot?.id || null,
      generated_at: new Date().toISOString(),
      generated_by: user.email,
    });

    return Response.json({
      report_version_id: reportVersion.id,
      report_code: reportCode,
      report_version_number: nextVersion,
      status: 'generated',
      payload_summary: {
        has_diagnostic: !!payload_snapshot.diagnostic_snapshot,
        has_action_plan: !!payload_snapshot.action_plan,
        task_count: payload_snapshot.tasks?.length || 0,
        review_count: payload_snapshot.reviews?.length || 0,
        plan_kpis: payload_snapshot.plan_kpis,
      },
    });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});