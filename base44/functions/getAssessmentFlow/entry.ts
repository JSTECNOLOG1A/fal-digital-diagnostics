/**
 * getAssessmentFlow
 * =====================================================================
 * Single backend aggregator for the post-diagnostic flow.
 *
 * Returns a single assembled contract:
 * {
 *   assessment,
 *   flow_state,       // AssessmentFlowState record (created if missing)
 *   steps: {
 *     diagnostic, priorities, intelligence, action_plan, simulation, report
 *   },
 *   next_best_step,
 *   is_complete,
 *   stale_from_step,
 * }
 *
 * Each step entry: { status, generated_at, stale, can_run, depends_on, message, data? }
 * =====================================================================
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

const CURRENT_FLOW_VERSION = 1;

const STEP_ORDER = ['diagnostic', 'priorities', 'intelligence', 'action_plan', 'simulation', 'report'];

const STEP_DEPENDS_ON = {
  diagnostic:   null,                  // diagnostic é a raiz — requer apenas questionário respondido
  priorities:   null,                  // prioridades NÃO dependem de diagnóstico inteligente; são calculadas sobre o snapshot base
  intelligence: 'priorities',          // inteligência depende de prioridades calculadas
  action_plan:  'intelligence',        // plano de ação depende de inteligência
  simulation:   'action_plan',
  report:       'action_plan',         // report depende de action_plan, não de simulation
};

function computeNextBestStep(steps) {
  for (const key of STEP_ORDER) {
    const s = steps[key];
    if (s.status === 'error') return key;
    if (s.status === 'not_started' && s.can_run) return key;
    if (s.status === 'stale' && s.can_run) return key;
  }
  return null;
}

function buildStepEntry({ key, flowState, responseVersion }) {
  const status = flowState[`${key}_status`] || 'not_started';
  const generated_at = flowState[`${key}_generated_at`] || null;
  const dependsOn = STEP_DEPENDS_ON[key];

  // Stale = ONLY when questionnaire responses changed after this step was computed.
  // Internal pipeline ordering (stale_from_step) is used only for can_run logic, NOT for UI stale banner.
  const sourceVersion = flowState.source_response_version || 0;
  const responsesChanged = status === 'done' && responseVersion > sourceVersion;
  const isStale = responsesChanged;

  // can_run: dependency step must be 'done' (status in flowState, ignoring pipeline stale_from_step)
  let can_run = false;
  if (!dependsOn) {
    can_run = true; // diagnostic can always run
  } else {
    const depStatus = flowState[`${dependsOn}_status`] || 'not_started';
    can_run = depStatus === 'done';
  }

  let message = null;
  if (isStale && generated_at) {
    message = `Respostas do questionário foram alteradas após esta análise. Execute novamente para atualizar.`;
  } else if (status === 'not_started') {
    if (key === 'priorities') {
      // Prioridades não dependem de etapa anterior; requerem apenas diagnóstico base calculado
      message = `Clique em "Gerar diagnóstico completo" para calcular prioridades.`;
    } else if (key === 'execution') {
      message = `Pronto para executar.`;
    } else {
      message = dependsOn
        ? `Requer "${dependsOn}" concluído primeiro.`
        : `Pronto para executar.`;
    }
  } else if (status === 'error') {
    message = flowState.last_error_message || `Erro na execução. Tente novamente.`;
  }

  return {
    status: isStale ? 'stale' : status,
    generated_at,
    stale: isStale,
    can_run,
    depends_on: dependsOn,
    message,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // SEG-03: Role guard — deny client_viewer from triggering flow state mutations
    const WRITE_ROLES = ['hq_admin', 'tenant_admin', 'consultant'];
    if (!WRITE_ROLES.includes(appRole)) {
      return Response.json({ error: 'Forbidden: insufficient role' }, { status: 403 });
    }

    const body = await req.json();
    const { assessment_id } = body;
    if (!assessment_id) return Response.json({ error: 'assessment_id required' }, { status: 400 });

    // Fetch assessment (use serviceRole if available, fallback to user)
    let assessment;
    try {
      assessment = await base44.asServiceRole.entities.Assessment.get(assessment_id);
    } catch {
      assessment = await base44.entities.Assessment.get(assessment_id);
    }
    if (!assessment) return Response.json({ error: 'Assessment not found' }, { status: 404 });

    // ── SEG-02 Tenant Guard: deny-by-default ──────────────────────────────────
    if (!isHQ) {
      if (!user.tenant_id || assessment.tenant_id !== user.tenant_id) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const responseVersion = assessment.current_response_version || 0;
    const tenantFilter = { tenant_id: assessment.tenant_id, assessment_id };

    // Fetch flow state and artifacts in parallel (limit results)
    // tenant_id in filters as defense-in-depth even after guard
    const [flowStateRecords, snapshots, actionPlans, reports] = await Promise.all([
      base44.asServiceRole.entities.AssessmentFlowState.filter(tenantFilter, '-created_date', 1),
      base44.asServiceRole.entities.FalDiagnosticSnapshot.filter(tenantFilter, '-computed_at', 1),
      base44.asServiceRole.entities.ActionPlan.filter(tenantFilter, '-created_date', 1),
      base44.asServiceRole.entities.Report.filter(tenantFilter, '-created_date', 1),
    ]);

    const snap = snapshots[0] || null;
     // Simplificar checks: base no existence, não em conteúdo
     const hasDiagnostic   = !!snap?.overall_score;
     const hasPriorities   = !!snap?.priority_computed_at;
     const hasIntelligence = !!snap?.intelligence_computed_at;
     const hasPlan         = (actionPlans[0]?.total_tasks || 0) > 0;
     const hasReport       = !!reports[0]?.pdf_url;

    let flowState;
    if (flowStateRecords.length === 0) {
      flowState = {
        tenant_id: assessment.tenant_id,
        assessment_id,
        flow_version: CURRENT_FLOW_VERSION,
        source_response_version: responseVersion,
        diagnostic_status:    hasDiagnostic   ? 'done' : 'not_started',
        priorities_status:    hasPriorities   ? 'done' : 'not_started',
        intelligence_status:  hasIntelligence ? 'done' : 'not_started',
        action_plan_status:   hasPlan         ? 'done' : 'not_started',
        simulation_status:    'not_started',
        report_status:        hasReport       ? 'done' : 'not_started',
        snapshot_id:              snap?.id || null,
        priorities_snapshot_id:   snap?.id || null,
        intelligence_snapshot_id: snap?.id || null,
        action_plan_id:           actionPlans[0]?.id || null,
        report_id:                reports[0]?.id || null,
        diagnostic_generated_at:   snap?.computed_at || null,
        priorities_generated_at:   snap?.priority_computed_at || null,
        intelligence_generated_at: snap?.intelligence_computed_at || null,
        action_plan_generated_at:  actionPlans[0]?.generated_at || null,
        report_generated_at:       reports[0]?.created_date || null,
        stale_from_step: null,
      };
      const created = await base44.asServiceRole.entities.AssessmentFlowState.create(flowState);
      flowState = { ...flowState, id: created.id };
    } else {
      flowState = { ...flowStateRecords[0] };

      // ── Always reconcile persisted statuses against real artifact truth ──────
      // This prevents stale/incorrect 'not_started' from blocking tabs.
      const updates = {};
      if (hasDiagnostic  && flowState.diagnostic_status   === 'not_started') { updates.diagnostic_status   = 'done'; updates.snapshot_id = snap.id; updates.diagnostic_generated_at = snap.computed_at; }
      if (hasPriorities  && flowState.priorities_status   === 'not_started') { updates.priorities_status   = 'done'; updates.priorities_snapshot_id = snap.id; updates.priorities_generated_at = snap.priority_computed_at; }
      if (hasIntelligence && flowState.intelligence_status === 'not_started') { updates.intelligence_status = 'done'; updates.intelligence_snapshot_id = snap.id; updates.intelligence_generated_at = snap.intelligence_computed_at; }
      if (hasPlan        && flowState.action_plan_status  === 'not_started') { updates.action_plan_status  = 'done'; updates.action_plan_id = actionPlans[0].id; updates.action_plan_generated_at = actionPlans[0].generated_at; }
      if (hasReport      && flowState.report_status       === 'not_started') { updates.report_status       = 'done'; updates.report_id = reports[0].id; }

      // ── Sync source_response_version: always runs, independent of other updates ──
      // Checks effective status (original + any pending updates) to detect all-core-done.
      // This is the primary fix for false "stale" banners after a complete pipeline run.
      const effectiveDiagnostic   = updates.diagnostic_status   || flowState.diagnostic_status;
      const effectivePriorities   = updates.priorities_status   || flowState.priorities_status;
      const effectiveIntelligence = updates.intelligence_status || flowState.intelligence_status;
      const allCoreDone = effectiveDiagnostic === 'done'
        && effectivePriorities === 'done'
        && effectiveIntelligence === 'done';
      if (allCoreDone && (flowState.source_response_version || 0) < responseVersion) {
        updates.source_response_version = responseVersion;
      }

      if (Object.keys(updates).length > 0) {
        Object.assign(flowState, updates);
        await base44.asServiceRole.entities.AssessmentFlowState.update(flowState.id, updates);
      } else if (allCoreDone && (flowState.source_response_version || 0) !== responseVersion) {
        // Edge case: tudo já done mas source_response_version desatualizado — força update imediato
        flowState.source_response_version = responseVersion;
        await base44.asServiceRole.entities.AssessmentFlowState.update(flowState.id, { source_response_version: responseVersion });
      }

      // Version mismatch → mark all stale
      if ((flowState.flow_version || 1) < CURRENT_FLOW_VERSION) {
        flowState = { ...flowState, stale_from_step: 'diagnostic' };
      }
    }

    // Build per-step entries — flowState already has updated source_response_version at this point
    const steps = {};
    for (const key of STEP_ORDER) {
      steps[key] = buildStepEntry({ key, flowState, responseVersion });
    }

    const next_best_step = computeNextBestStep(steps);
    const is_complete = STEP_ORDER.every(k => steps[k].status === 'done');

    // Update next_best_step on flow state record
    if (flowState.id && flowState.next_best_step !== next_best_step) {
      await base44.asServiceRole.entities.AssessmentFlowState.update(flowState.id, { next_best_step });
    }

    return Response.json({
      ok: true,
      assessment,
      flow_state: flowState,
      steps,
      next_best_step,
      is_complete,
      stale_from_step: flowState.stale_from_step || null,
      response_version: responseVersion,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});