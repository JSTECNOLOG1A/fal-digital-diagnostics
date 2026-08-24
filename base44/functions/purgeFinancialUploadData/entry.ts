/**
 * purgeFinancialUploadData — Reset NUCLEAR com manifesto auditável (F2-PUR-01).
 *
 * v2: Cada delete produz um manifesto before/deleted/after/status.
 * Erros não são engolidos — uma falha parcial retorna success=false.
 * O diagnóstico só é resetado se TODAS as pós-condições forem atendidas.
 *
 * Payload: { diagnosis_id, confirm?: boolean }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

const ALLOWED_DELETE_ROLES = new Set(['hq_admin', 'tenant_admin']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });
    if (!ALLOWED_DELETE_ROLES.has(appRole)) {
      return Response.json({ error: 'Permissão insuficiente para operação destrutiva' }, { status: 403 });
    }

    const { diagnosis_id, confirm } = await req.json();
    if (!diagnosis_id) return Response.json({ error: 'diagnosis_id obrigatório' }, { status: 400 });
    if (!confirm) {
      return Response.json({ error: 'Confirmação explícita necessária (confirm=true)' }, { status: 400 });
    }

    const diagnosis = await base44.asServiceRole.entities.FinancialDiagnosis.get(diagnosis_id);
    if (!diagnosis) return Response.json({ error: 'Diagnóstico não encontrado' }, { status: 404 });
    if (appRole !== 'hq_admin' && diagnosis.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden: diagnóstico não pertence ao seu tenant' }, { status: 403 });
    }

    // ── Create processing run for purge (idempotência) ──
    const operationKey = `${diagnosis.tenant_id}|${diagnosis_id}||purge_diagnosis|||`;
    const now = new Date().toISOString();

    // F2-UPL-01: No catch+warn+continue — run check failure aborts.
    const existingRuns = await base44.asServiceRole.entities.FinancialProcessingRun.filter(
      { operation_key: operationKey, status: { $in: ['running', 'succeeded'] } }, 'id', 10
    );
    if (existingRuns.length > 0) {
      const existingRun = existingRuns[0];
      if (existingRun.status === 'running') {
        return Response.json({
          success: true, reused: true, run_id: existingRun.id, status: 'running',
          message: 'Purge nuclear já em andamento',
        });
      }
      return Response.json({
        success: true, reused: true, completed: true, run_id: existingRun.id, status: 'succeeded',
        message: 'Purge nuclear já concluído',
      });
    }

    let run;
    try {
      run = await base44.asServiceRole.entities.FinancialProcessingRun.create({
        tenant_id: diagnosis.tenant_id,
        financial_diagnosis_id: diagnosis_id,
        operation_type: 'purge_diagnosis',
        operation_key: operationKey,
        status: 'running',
        started_at: now,
        triggered_by: user.email,
      });
    } catch (e) {
      return Response.json({ error: 'Falha ao criar processing run: ' + e.message }, { status: 500 });
    }

    // ── deleteWithManifest: each delete tracked with before/deleted/after/status ──
    const deleteWithManifest = async (entityName, query, name) => {
      try {
        const items = await base44.asServiceRole.entities[entityName].filter(query, 'id', 5000);
        const arr = Array.isArray(items) ? items.filter((i) => i?.id) : [];
        const before = arr.length;
        if (before === 0) return { before: 0, deleted: 0, after: 0, status: 'success' };
        let deleted = 0;
        const BATCH = 20;
        for (let i = 0; i < arr.length; i += BATCH) {
          const results = await Promise.allSettled(
            arr.slice(i, i + BATCH).map((item) => base44.asServiceRole.entities[entityName].delete(item.id))
          );
          deleted += results.filter((r) => r.status === 'fulfilled').length;
        }
        const after = before - deleted;
        return { before, deleted, after, status: after === 0 ? 'success' : 'partial_failed' };
      } catch (e) {
        console.error(`[purge] erro em ${name}:`, e.message);
        return { before: -1, deleted: 0, after: -1, status: 'failed', error: e.message };
      }
    };

    const uploads = await base44.asServiceRole.entities.FinancialUpload.filter(
      { financial_diagnosis_id: diagnosis_id }, 'id', 100
    );

    const manifest = {};
    const failedEntities = [];

    // Per-upload derivatives
    for (const upload of uploads) {
      const q = { financial_upload_id: upload.id };
      for (const e of ['FinancialMappingResolution', 'FinancialStatementLine', 'FinancialTrialBalanceLine',
        'FinancialValidationResult', 'FinancialIndicatorSnapshot', 'FinancialDfcCompositionLine']) {
        const key = `${e}[${upload.id}]`;
        const r = await deleteWithManifest(e, q, key);
        manifest[key] = r;
        if (r.status !== 'success') failedEntities.push({ entity: key, ...r });
      }
    }

    // Per-diagnosis (orphans + entities without upload_id)
    const qDiag = { financial_diagnosis_id: diagnosis_id };
    for (const e of ['FinancialAlert', 'FinancialStatementLine', 'FinancialTrialBalanceLine',
      'FinancialIndicatorSnapshot', 'FinancialMappingResolution', 'FinancialValidationResult',
      'FinancialDfcCompositionLine', 'FinancialFinding', 'FinancialRecommendation',
      'FinancialActionProposal', 'FinancialReportVersion', 'FinancialAnalysisScopeEntity',
      'PreparedFinancialDatasetLine', 'FinancialConsolidationEntry',
      'FinancialIntercompanyReconciliation', 'FinancialPreparationRun']) {
      const key = `${e}[diagnosis]`;
      const r = await deleteWithManifest(e, qDiag, key);
      manifest[key] = r;
      if (r.status !== 'success') failedEntities.push({ entity: key, ...r });
    }

    // Delete uploads themselves
    for (const upload of uploads) {
      const key = `FinancialUpload[${upload.id}]`;
      try {
        await base44.asServiceRole.entities.FinancialUpload.delete(upload.id);
        manifest[key] = { before: 1, deleted: 1, after: 0, status: 'success' };
      } catch (e) {
        manifest[key] = { before: 1, deleted: 0, after: 1, status: 'failed', error: e.message };
        failedEntities.push({ entity: key, error: e.message });
      }
    }

    // ── Post-condition: check no derivatives remain ──
    for (const e of ['FinancialStatementLine', 'FinancialIndicatorSnapshot', 'FinancialValidationResult',
      'FinancialTrialBalanceLine', 'FinancialMappingResolution', 'PreparedFinancialDatasetLine']) {
      const remaining = await base44.asServiceRole.entities[e].filter(qDiag, 'id', 100);
      if (Array.isArray(remaining) && remaining.length > 0) {
        failedEntities.push({ entity: e, issue: 'post_condition_failed', remaining: remaining.length });
      }
    }

    const allSuccess = failedEntities.length === 0;

    // ── Only reset diagnosis if all deletes succeeded ──
    if (allSuccess) {
      await base44.asServiceRole.entities.FinancialDiagnosis.update(diagnosis_id, {
        status: 'draft',
        current_upload_id: null,
        current_preparation_run_id: null,
        first_period: null,
        last_period: null,
        months_count: null,
        integrity_status: 'unknown',
        integrity_blocking_count: 0,
        integrity_warning_count: 0,
        integrity_checked_at: new Date().toISOString(),
      });
      await base44.asServiceRole.entities.FinancialProcessingRun.update(run.id, {
        status: 'succeeded',
        completed_at: new Date().toISOString(),
        manifest_after: manifest,
        result_summary: { success: true },
      });
      return Response.json({ success: true, status: 'succeeded', run_id: run.id, manifest, failed_entities: [] });
    } else {
      // Partial failure — don't reset diagnosis
      await base44.asServiceRole.entities.FinancialProcessingRun.update(run.id, {
        status: 'partial_failed',
        completed_at: new Date().toISOString(),
        manifest_after: manifest,
        error_details: { failed_entities: failedEntities },
        result_summary: { success: false },
      });
      return Response.json({
        success: false,
        status: 'partial_failed',
        run_id: run.id,
        manifest,
        failed_entities: failedEntities,
        message: 'Purge parcial — diagnóstico NÃO foi resetado (permanece no status atual)',
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[purge] erro geral:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});