import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const OUTPUT_ENTITIES = ['FinancialStatementLine', 'FinancialIndicatorSnapshot', 'FinancialValidationResult', 'FinancialMappingResolution', 'FinancialTrialBalanceLine', 'FinancialDfcCompositionLine'];
const WRITE_ROLES = ['hq_admin', 'tenant_admin', 'consultant'];
const LIFECYCLE_ENGINE_VERSION = 'FAL-FIN-LIFECYCLE-1.0.0';
const LIFECYCLE_ENGINE_HASH = '8eb5018d13d3ebaab59985b504e7bda63bbbc9f5f9e75c5453d5c7a61dfc29e9';
function lifecycleCanonicalize(value) { if (value === null || value === undefined || typeof value !== 'object') return value ?? null; if (Array.isArray(value)) return value.map(lifecycleCanonicalize); return Object.fromEntries(Object.keys(value).sort().map((key) => [key, lifecycleCanonicalize(value[key])])); }
async function invokeFinancialLifecycleDeterminismEngine(base44, operation, input) { const response = await base44.functions.invoke('financialLifecycleDeterminismEngine', { contract_version: LIFECYCLE_ENGINE_VERSION, operation, input }); const result = response?.data || response; const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(input))); const fingerprint = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join(''); if (!result?.success || result.engine_version !== LIFECYCLE_ENGINE_VERSION || result.contract_hash !== LIFECYCLE_ENGINE_HASH || result.operation !== operation || result.input_fingerprint !== fingerprint) throw new Error('FINANCIAL_LIFECYCLE_ENGINE_CONTRACT_MISMATCH'); return result.decision; }

Deno.serve(async (req) => {
  let base44 = null; let processingRunId = null;
  try {
    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const appRole = user.app_role || (user.role === 'admin' ? 'hq_admin' : null);
    if (!WRITE_ROLES.includes(appRole)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    ({ processing_run_id: processingRunId } = await req.json());
    if (!processingRunId) return Response.json({ error: 'CLEANUP_INPUT_REQUIRED' }, { status: 400 });
    const run = await base44.asServiceRole.entities.FinancialProcessingRun.get(processingRunId);
    if (!run || run.status !== 'succeeded') return Response.json({ error: 'CLEANUP_CURRENT_RUN_REQUIRED' }, { status: 409 });
    if (appRole !== 'hq_admin' && run.tenant_id !== user.tenant_id) return Response.json({ error: 'TENANT_MISMATCH' }, { status: 403 });

    const cleanupTargets = run.result_summary?.cleanup_targets || [];
    const previousRunIds = [...new Set(cleanupTargets.map((target) => target.previous_processing_run_id).filter(Boolean))];
    if (!previousRunIds.length) {
      await base44.asServiceRole.entities.FinancialProcessingRun.update(run.id, { cleanup_pending: false, error_details: null, result_summary: { ...(run.result_summary || {}), deferred_run_ids: [] } });
      return Response.json({ success: true, processing_run_id: processingRunId, rows_changed: 0, already_clean: true, cleanup_pending: false, deferred_run_ids: [] });
    }

    const diagnosis = await base44.asServiceRole.entities.FinancialDiagnosis.get(run.financial_diagnosis_id);
    const currentSnapshot = diagnosis?.current_processing_snapshot_id ? await base44.asServiceRole.entities.FinancialProcessingSnapshot.get(diagnosis.current_processing_snapshot_id) : null;
    const currentDiagnosisRunId = currentSnapshot?.status === 'active' ? currentSnapshot.financial_processing_run_id : null;
    const now = new Date().toISOString(); let rowsChanged = 0; const deferredRunIds = [];
    for (const previousRunId of previousRunIds) {
      const headsStillCurrent = await base44.asServiceRole.entities.FinancialSourceOutputHead.filter({ financial_diagnosis_id: run.financial_diagnosis_id, current_processing_run_id: previousRunId, status: 'active' }, 'id', 500);
      const cleanupDecision = await invokeFinancialLifecycleDeterminismEngine(base44, 'evaluate_cleanup_state', { previous_run_id: previousRunId, active_source_head_references: headsStillCurrent.map((head) => head.id), diagnosis_pointer_reference: currentDiagnosisRunId, cleanup_attempt_result: {} });
      if (cleanupDecision.action === 'DEFER') { deferredRunIds.push(previousRunId); continue; }
      if (cleanupDecision.action !== 'SUPERSEDE_RUN') throw new Error('CLEANUP_ENGINE_RETRY_REQUIRED');
      for (const entityName of OUTPUT_ENTITIES) {
        const filter = { financial_diagnosis_id: run.financial_diagnosis_id, processing_run_id: previousRunId, publication_status: 'active' };
        const activeRows = await base44.asServiceRole.entities[entityName].filter(filter, 'id', 50000);
        if (!activeRows.length) continue;
        await base44.asServiceRole.entities[entityName].updateMany(filter, { $set: { publication_status: 'superseded', superseded_at: now } });
        if ((await base44.asServiceRole.entities[entityName].filter(filter, 'id', 1)).length) throw new Error(`CLEANUP_ENTITY_POSTCONDITION_FAILED:${entityName}:${previousRunId}`);
        rowsChanged += activeRows.length;
      }
    }
    const cleanupPending = deferredRunIds.length > 0;
    await base44.asServiceRole.entities.FinancialProcessingRun.update(run.id, { cleanup_pending: cleanupPending, error_details: cleanupPending ? { reason: 'CLEANUP_DEFERRED_CURRENT_REFERENCE', deferred_run_ids: deferredRunIds } : null, result_summary: { ...(run.result_summary || {}), cleanup_targets: cleanupTargets, deferred_run_ids: deferredRunIds } });
    return Response.json({ success: true, processing_run_id: processingRunId, rows_changed: rowsChanged, already_clean: rowsChanged === 0 && !cleanupPending, cleanup_pending: cleanupPending, deferred_run_ids: deferredRunIds, reason: cleanupPending ? 'CLEANUP_DEFERRED_CURRENT_REFERENCE' : null });
  } catch (error) {
    if (base44 && processingRunId) await base44.asServiceRole.entities.FinancialProcessingRun.update(processingRunId, { cleanup_pending: true, error_details: { cleanup_error: error.message, last_cleanup_attempt_at: new Date().toISOString() } });
    return Response.json({ error: error.message, cleanup_pending: Boolean(processingRunId) }, { status: 500 });
  }
});