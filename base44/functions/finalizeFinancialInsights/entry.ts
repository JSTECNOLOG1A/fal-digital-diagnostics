/**
 * finalizeFinancialInsights — F2-UPL-01 (RESIDUAL 3).
 *
 * Wrapper que chama generateFinancialInterpretations + generateFinancialRecommendations.
 *
 * v3 (RESIDUAL 3):
 *   - Write guard BEFORE run creation — client_viewer recebe 403 e zero mutations.
 *   - Run creation failure ABORTS the operation (no catch+warn+continue).
 *   - Run completion is mandatory — no run stays 'running'.
 *
 * Payload: { financial_diagnosis_id }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

// Write guard — client_viewer NÃO pode finalizar insights
const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);

Deno.serve(async (req) => {
  let runId = null;
  let base44;
  try {
    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    // ── Write guard BEFORE any mutation or run creation ──
    if (!WRITE_ROLES.has(appRole)) {
      return Response.json({ error: 'Forbidden: write permission required' }, { status: 403 });
    }

    const body = await req.json();
    const { financial_diagnosis_id } = body;
    if (!financial_diagnosis_id) {
      return Response.json({ error: 'financial_diagnosis_id é obrigatório' }, { status: 400 });
    }

    const diagnosis = await base44.asServiceRole.entities.FinancialDiagnosis.get(financial_diagnosis_id);
    if (!diagnosis) return Response.json({ error: 'Diagnóstico não encontrado' }, { status: 404 });
    if (appRole !== 'hq_admin' && diagnosis.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden: diagnóstico não pertence ao seu tenant' }, { status: 403 });
    }

    // ── F2-UPL-01: Idempotência via FinancialProcessingRun ──
    // No catch+warn+continue — run creation failure ABORTS the operation.
    const operationKey = [
      diagnosis.tenant_id, financial_diagnosis_id, '', 'finalize_insights', '', '', diagnosis.current_processing_snapshot_id || diagnosis.updated_date || ''
    ].join('|');

    const existingRuns = await base44.asServiceRole.entities.FinancialProcessingRun.filter(
      { operation_key: operationKey, status: { $in: ['running', 'succeeded'] } }, 'id', 10
    );
    if (existingRuns.length > 0) {
      const existing = existingRuns[0];
      if (existing.status === 'succeeded') {
        return Response.json({
          success: true, reused: true, run_id: existing.id, status: 'succeeded',
          message: 'Operação já concluída',
        });
      }
      return Response.json({
        success: true, reused: true, run_id: existing.id, status: 'running',
        message: 'Operação já em andamento',
      });
    }

    const now = new Date().toISOString();
    const run = await base44.asServiceRole.entities.FinancialProcessingRun.create({
      tenant_id: diagnosis.tenant_id,
      financial_diagnosis_id,
      operation_type: 'finalize_insights',
      operation_key: operationKey,
      status: 'running',
      started_at: now,
      triggered_by: user.email,
    });
    runId = run.id;
    // 1. Gerar achados automáticos
    const interpResult = await base44.asServiceRole.functions.invoke('generateFinancialInterpretations', {
      financial_diagnosis_id,
      mode: 'replace',
    });

    // 2. Gerar recomendações
    const recResult = await base44.asServiceRole.functions.invoke('generateFinancialRecommendations', {
      financial_diagnosis_id,
      mode: 'replace',
    });

    // ── Complete run (mandatory) ──
    const findingsCreated = interpResult?.created_count ?? 0;
    const recommendationsCreated = recResult?.recommendations_created ?? 0;
    const actionProposalsCreated = recResult?.action_proposals_created ?? 0;

    await base44.asServiceRole.entities.FinancialProcessingRun.update(runId, {
      status: 'succeeded',
      completed_at: new Date().toISOString(),
      result_summary: {
        success: true,
        snapshot_pending: true,
        findings_created: findingsCreated,
        recommendations_created: recommendationsCreated,
        action_proposals_created: actionProposalsCreated,
      },
    });
    const snapshotResponse = await base44.functions.invoke('createFinancialProcessingSnapshot', {
      financial_diagnosis_id,
      processing_run_id: runId,
    });
    const snapshot = snapshotResponse?.data || snapshotResponse;
    if (!snapshot?.snapshot_id) throw new Error('Finalização sem snapshot obrigatório');

    return Response.json({
      success: true,
      run_id: runId,
      snapshot_id: snapshot.snapshot_id,
      output_checksum: snapshot.output_checksum,
      findings_created: findingsCreated,
      recommendations_created: recommendationsCreated,
      action_proposals_created: actionProposalsCreated,
    });
  } catch (error) {
    // ── Fail run on any error (no run stays 'running') ──
    if (runId && base44) {
      try {
        await base44.asServiceRole.entities.FinancialProcessingRun.update(runId, {
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_details: { error: error.message },
          result_summary: { success: false, error: error.message },
        });
      } catch (e) {
        console.error('[finalizeInsights] erro ao marcar run como failed:', e.message);
      }
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
});