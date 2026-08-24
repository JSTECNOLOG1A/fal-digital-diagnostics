/**
 * onFalResponseChange
 * =====================================================================
 * Entity automation handler — triggered on FalResponse create/update.
 *
 * Responsibilities:
 * 1. Increment Assessment.current_response_version (only on meaningful change)
 * 2. Mark AssessmentFlowState.stale_from_step = "diagnostic"
 * 3. Mark all downstream step statuses as "stale"
 *
 * Meaningful change = new response OR score/justification/confidence/evidence changed.
 * Idempotent save (same values re-saved) does NOT increment version.
 * =====================================================================
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DOWNSTREAM_STEPS = ['diagnostic', 'priorities', 'intelligence', 'action_plan', 'simulation', 'report'];

function isMeaningfulChange(data, oldData) {
  if (!oldData) return true; // new response = always meaningful
  return (
    data.score !== oldData.score ||
    data.justification !== oldData.justification ||
    data.confidence_level !== oldData.confidence_level ||
    (data.evidence_notes || '') !== (oldData.evidence_notes || '')
  );
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { event, data, old_data } = body;

    if (!data?.assessment_id) {
      return Response.json({ skipped: true, reason: 'no assessment_id' });
    }

    // Only process create/update events
    if (!['create', 'update'].includes(event?.type)) {
      return Response.json({ skipped: true, reason: 'not create/update' });
    }

    // Check if change is meaningful (skip no-op saves)
    if (event.type === 'update' && !isMeaningfulChange(data, old_data)) {
      return Response.json({ skipped: true, reason: 'no meaningful change' });
    }

    const assessmentId = data.assessment_id;

    // 1. Increment Assessment.current_response_version
    const assessment = await base44.asServiceRole.entities.Assessment.get(assessmentId);
    if (!assessment) return Response.json({ skipped: true, reason: 'assessment not found' });

    // ── SEG-02: Tenant guard — if invoked by a user (not automation), verify ownership ──
    let user = null;
    try { user = await base44.auth.me(); } catch (e) { user = null; }
    if (user && assessment.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden — cross-tenant access denied' }, { status: 403 });
    }

    const newVersion = (assessment.current_response_version || 0) + 1;
    await base44.asServiceRole.entities.Assessment.update(assessmentId, {
      current_response_version: newVersion,
    });

    // 2. Upsert AssessmentFlowState — mark everything downstream as stale
    const existing = await base44.asServiceRole.entities.AssessmentFlowState.filter({
      assessment_id: assessmentId,
    }, '-created_date', 1);

    const staleUpdate = {
      stale_from_step: 'diagnostic',
      diagnostic_status: 'stale',
      priorities_status: 'stale',
      intelligence_status: 'stale',
      action_plan_status: 'stale',
      simulation_status: 'stale',
      report_status: 'stale',
      source_response_version: newVersion,
    };

    if (existing.length > 0) {
      await base44.asServiceRole.entities.AssessmentFlowState.update(existing[0].id, staleUpdate);
    } else {
      await base44.asServiceRole.entities.AssessmentFlowState.create({
        tenant_id: assessment.tenant_id,
        assessment_id: assessmentId,
        ...staleUpdate,
      });
    }

    return Response.json({
      ok: true,
      assessment_id: assessmentId,
      new_response_version: newVersion,
      stale_from: 'diagnostic',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});