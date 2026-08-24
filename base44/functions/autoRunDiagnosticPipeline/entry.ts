/**
 * autoRunDiagnosticPipeline
 * =====================================================================
 * Triggered automatically when a FalResponse is created/updated.
 *
 * Checks if the assessment's questionnaire is 100% complete.
 * If yes, and the diagnostic pipeline is not yet done / is stale,
 * runs the full pipeline: computeFalDiagnostic → computeFalPriority → computeClusterIntelligence.
 *
 * Idempotent: skips if pipeline is already up-to-date.
 * =====================================================================
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data } = body;

    if (!data?.assessment_id) {
      return Response.json({ skipped: true, reason: 'no assessment_id' });
    }

    if (!['create', 'update'].includes(event?.type)) {
      return Response.json({ skipped: true, reason: 'not create/update' });
    }

    const assessmentId = data.assessment_id;

    // 1. Load assessment
    const assessment = await base44.asServiceRole.entities.Assessment.get(assessmentId);
    if (!assessment) return Response.json({ skipped: true, reason: 'assessment not found' });

    // ── SEG-02: Tenant guard — if invoked by a user (not automation), verify ownership ──
    let user = null;
    try { user = await base44.auth.me(); } catch (e) { user = null; }
    if (user && assessment.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden — cross-tenant access denied' }, { status: 403 });
    }

    const questionSet = assessment.question_set || [];
    if (questionSet.length === 0) {
      return Response.json({ skipped: true, reason: 'no question_set' });
    }

    // 2. Check if all questions in the question_set have been answered
    const responses = await base44.asServiceRole.entities.FalResponse.filter({ assessment_id: assessmentId });
    const answeredIds = new Set(responses.map(r => r.fal_question_id));
    const allAnswered = questionSet.every(id => answeredIds.has(id));

    if (!allAnswered) {
      const remaining = questionSet.filter(id => !answeredIds.has(id)).length;
      return Response.json({ skipped: true, reason: `questionnaire not complete — ${remaining} questions remaining` });
    }

    // 3. Check flow state — skip if pipeline already up-to-date
    const flowStates = await base44.asServiceRole.entities.AssessmentFlowState.filter(
      { assessment_id: assessmentId }, '-created_date', 1
    );
    const flowState = flowStates[0] || null;

    const responseVersion = assessment.current_response_version || 0;
    const sourceVersion = flowState?.source_response_version || 0;
    const diagnosticDone = flowState?.diagnostic_status === 'done';
    const prioritiesDone = flowState?.priorities_status === 'done';
    const intelligenceDone = flowState?.intelligence_status === 'done';
    const allCoreDone = diagnosticDone && prioritiesDone && intelligenceDone;

    if (allCoreDone && sourceVersion >= responseVersion) {
      return Response.json({ skipped: true, reason: 'pipeline already up-to-date' });
    }

    console.log(`[autoRunDiagnosticPipeline] Assessment ${assessmentId} is 100% complete. Running pipeline...`);

    // 4. Run pipeline sequentially
    const steps = [
      { key: 'diagnostic',   fn: 'computeFalDiagnostic' },
      { key: 'priorities',   fn: 'computeFalPriority' },
      { key: 'intelligence', fn: 'computeClusterIntelligence' },
    ];

    const results = {};
    for (const step of steps) {
      // Skip steps already done and not stale
      const stepStatus = flowState?.[`${step.key}_status`];
      if (stepStatus === 'done' && sourceVersion >= responseVersion) {
        results[step.key] = 'skipped (already done)';
        continue;
      }

      console.log(`[autoRunDiagnosticPipeline] Running step: ${step.fn}`);
      const res = await base44.asServiceRole.functions.invoke(step.fn, { assessment_id: assessmentId });

      if (res?.error) {
        console.error(`[autoRunDiagnosticPipeline] Step ${step.fn} failed: ${res.error}`);
        results[step.key] = `error: ${res.error}`;
        // Stop pipeline on error
        return Response.json({ ok: false, stopped_at: step.key, results });
      }

      results[step.key] = 'done';
    }

    // 5. Best-effort: update group aggregate
    const groupId = assessment.group_id || (assessment.target_type === 'group' ? assessment.target_id : null);
    if (groupId) {
      await base44.asServiceRole.functions.invoke('computeGroupAggregate', {
        group_id: groupId,
        tenant_id: assessment.tenant_id,
      }).catch(() => {});
    }

    console.log(`[autoRunDiagnosticPipeline] Pipeline complete for assessment ${assessmentId}`);
    return Response.json({ ok: true, assessment_id: assessmentId, results });

  } catch (error) {
    console.error(`[autoRunDiagnosticPipeline] Unexpected error: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});