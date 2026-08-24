/**
 * purgeFinancialDerivedData — Limpeza cirúrgica com manifesto auditável (F2-PUR-01).
 *
 * v3 (RESIDUAL 1):
 *   - 8: Restringe purge apenas aos runs realmente superseded — NÃO usa query genérica
 *     { preparation_run_id: { $exists: true } } que alcança outputs de qualquer run.
 *   - Guarda os IDs realmente superseded e exclui apenas esses.
 *   - Cria FinancialProcessingRun para o purge (idempotência).
 *
 * Payload: { upload_id, diagnosis_id }
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

    const { upload_id, diagnosis_id } = await req.json();
    if (!upload_id || !diagnosis_id) {
      return Response.json({ error: 'upload_id e diagnosis_id são obrigatórios' }, { status: 400 });
    }

    const diagnosis = await base44.asServiceRole.entities.FinancialDiagnosis.get(diagnosis_id);
    if (!diagnosis) return Response.json({ error: 'Diagnóstico não encontrado' }, { status: 404 });
    if (appRole !== 'hq_admin' && diagnosis.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden: diagnóstico não pertence ao seu tenant' }, { status: 403 });
    }

    // ── Create processing run for purge (idempotência) ──
    const operationKey = `${diagnosis.tenant_id}|${diagnosis_id}|${upload_id}|purge_derived|||`;
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
          message: 'Purge já em andamento',
        });
      }
      return Response.json({
        success: true, reused: true, completed: true, run_id: existingRun.id, status: 'succeeded',
        message: 'Purge já concluído',
      });
    }

    let run;
    try {
      run = await base44.asServiceRole.entities.FinancialProcessingRun.create({
        tenant_id: diagnosis.tenant_id,
        financial_diagnosis_id: diagnosis_id,
        financial_upload_id: upload_id,
        operation_type: 'purge_derived',
        operation_key: operationKey,
        status: 'running',
        started_at: now,
        triggered_by: user.email,
      });
    } catch (e) {
      return Response.json({ error: 'Falha ao criar processing run: ' + e.message }, { status: 500 });
    }

    const failRun = async (errorMsg, failedEntities = []) => {
      try {
        await base44.asServiceRole.entities.FinancialProcessingRun.update(run.id, {
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_details: { error: errorMsg, failed_entities: failedEntities },
          result_summary: { success: false },
        });
      } catch (e) { console.warn('[purgeDerived] erro ao atualizar run:', e.message); }
    };

    // ── deleteWithManifest: tracks before/deleted/after/status ──
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
        console.error(`[purgeDerived] erro em ${name}:`, e.message);
        return { before: -1, deleted: 0, after: -1, status: 'failed', error: e.message };
      }
    };

    const qUpload = { financial_upload_id: upload_id };
    const qDiag = { financial_diagnosis_id: diagnosis_id };

    const manifest = {};
    const failedEntities = [];

    // ── Derivatives of the specific upload ──
    const derivativeEntities = [
      'FinancialStatementLine', 'FinancialTrialBalanceLine', 'FinancialValidationResult',
      'FinancialMappingResolution', 'FinancialIndicatorSnapshot', 'FinancialDfcCompositionLine',
      'FinancialAlert',
    ];
    for (const e of derivativeEntities) {
      const r = await deleteWithManifest(e, qUpload, e);
      manifest[e] = r;
      if (r.status !== 'success') failedEntities.push({ entity: e, ...r });
    }

    // ── 8: Preparation runs — guardar IDs realmente superseded, NÃO query genérica ──
    let runsSuperseded = 0;
    let preparedLinesResult = { before: 0, deleted: 0, after: 0, status: 'success' };
    let entriesPreserved = 0;
    const supersededRunIds = [];
    try {
      const runs = await base44.asServiceRole.entities.FinancialPreparationRun.filter(
        { financial_diagnosis_id: diagnosis_id, status: { $in: ['draft', 'processing', 'prepared'] } }, 'id', 50
      );
      // 8: Guardar os IDs realmente superseded
      for (const runItem of runs) {
        supersededRunIds.push(runItem.id);
      }
      // Delete prepared lines of these runs (apenas dos runs superseded)
      for (const runId of supersededRunIds) {
        preparedLinesResult = await deleteWithManifest('PreparedFinancialDatasetLine', { preparation_run_id: runId }, 'prepared_lines');
        manifest[`PreparedFinancialDatasetLine[run:${runId}]`] = preparedLinesResult;
        if (preparedLinesResult.status !== 'success') failedEntities.push({ entity: 'PreparedFinancialDatasetLine', run_id: runId, ...preparedLinesResult });
        // Supersede the run (preserve rastreabilidade)
        await base44.asServiceRole.entities.FinancialPreparationRun.update(runId, {
          status: 'superseded',
          superseded_by_run_id: null,
        });
        runsSuperseded++;
      }
      // Count preserved entries
      const approvedEntries = await base44.asServiceRole.entities.FinancialConsolidationEntry.filter(
        { financial_diagnosis_id: diagnosis_id, status: { $in: ['approved', 'posted'] } }, 'id', 500
      );
      entriesPreserved = approvedEntries.length;
    } catch (e) {
      console.warn('[purgeDerived] preparation runs:', e.message);
      manifest['preparation_runs'] = { status: 'failed', error: e.message };
      failedEntities.push({ entity: 'preparation_runs', error: e.message });
    }

    manifest['preparation_runs_superseded'] = runsSuperseded;
    manifest['entries_preserved'] = entriesPreserved;
    manifest['superseded_run_ids'] = supersededRunIds;

    // ── 8: Delete outputs linked to superseded runs (apenas dos runs superseded, NÃO genérico) ──
    for (const e of ['FinancialStatementLine', 'FinancialIndicatorSnapshot', 'FinancialDfcCompositionLine']) {
      for (const runId of supersededRunIds) {
        const key = `${e}[run:${runId}]`;
        const r = await deleteWithManifest(e, { financial_diagnosis_id: diagnosis_id, preparation_run_id: runId }, key);
        manifest[key] = r;
        if (r.status !== 'success') failedEntities.push({ entity: key, ...r });
      }
    }

    // ── Post-condition ──
    for (const e of ['FinancialStatementLine', 'FinancialIndicatorSnapshot']) {
      const remaining = await base44.asServiceRole.entities[e].filter(qUpload, 'id', 100);
      if (Array.isArray(remaining) && remaining.length > 0) {
        failedEntities.push({ entity: e, issue: 'post_condition_failed', remaining: remaining.length });
      }
    }

    const allSuccess = failedEntities.length === 0;

    // ── Only update diagnosis status if all deletes succeeded ──
    if (allSuccess) {
      await base44.asServiceRole.entities.FinancialDiagnosis.update(diagnosis_id, {
        status: 'validated',
        current_preparation_run_id: null,
        integrity_status: 'unknown',
        integrity_checked_at: new Date().toISOString(),
      });
      // Complete the run
      await base44.asServiceRole.entities.FinancialProcessingRun.update(run.id, {
        status: 'succeeded',
        completed_at: new Date().toISOString(),
        manifest_after: manifest,
        result_summary: {
          success: true,
          runs_superseded: runsSuperseded,
          entries_preserved: entriesPreserved,
        },
      });
      return Response.json({
        success: true,
        status: 'succeeded',
        run_id: run.id,
        manifest,
        runs_superseded: runsSuperseded,
        entries_preserved: entriesPreserved,
        failed_entities: [],
      });
    } else {
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
        runs_superseded: runsSuperseded,
        entries_preserved: entriesPreserved,
        failed_entities: failedEntities,
        message: 'Purge parcial — diagnóstico NÃO foi resetado',
      }, { status: 500 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});