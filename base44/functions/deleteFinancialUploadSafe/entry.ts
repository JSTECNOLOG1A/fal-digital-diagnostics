/** deleteFinancialUploadSafe — R7, workflow canônico gerado + adapter Base44. */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
const ALLOWED_DELETE_ROLES = new Set(['hq_admin', 'tenant_admin']);
const MONTHS_PER_PERIOD = { mensal: 1, trimestral: 3, anual: 12 };
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user.app_role)) return user.app_role;
  return user.role === 'admin' ? 'hq_admin' : null;
}
function normalizePeriod(value) { return value ? String(value).replace(/[^0-9-]/g, '').slice(0, 7) : null; }
function stripAutoFields(record) {
  const copy = { ...record };
  for (const key of ['id', 'created_date', 'updated_date', 'created_by_id']) delete copy[key];
  return copy;
}

// generated-source-sha256: eb2306dabfae552138940eb3c326f0a63f793a0d58164998fd826a294b2a8ffd
// <generated-delete-workflow>
const DELETE_WORKFLOW_VERSION = 'r6-recovery-v1';
const CONCURRENCY_GUARANTEE = 'best_effort';
const DERIVATIVE_ENTITIES = [
  'FinancialStatementLine', 'FinancialTrialBalanceLine', 'FinancialValidationResult',
  'FinancialMappingResolution', 'FinancialIndicatorSnapshot', 'FinancialAlert',
  'FinancialDfcCompositionLine',
];

function canonicalize(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const excluded = new Set(['id', 'created_date', 'updated_date', 'created_by_id']);
  return Object.fromEntries(Object.keys(value).sort().filter((key) => !excluded.has(key)).map((key) => [key, canonicalize(value[key])]));
}

async function canonicalChecksum(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(value)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function beginOrReuseBestEffort(repository, operationKey, runInput) {
  let existingRuns;
  try {
    existingRuns = await repository.findRuns(operationKey);
  } catch (error) {
    return { error: 'PROCESSING_RUN_LOOKUP_UNAVAILABLE', detail: error.message, http_status: 503, mutations: 0, concurrency_guarantee: CONCURRENCY_GUARANTEE, atomicity_verified: false };
  }
  const existing = existingRuns.find((run) => ['running', 'committing', 'succeeded'].includes(run.status));
  if (existing) return { reused: true, run: existing, concurrency_guarantee: CONCURRENCY_GUARANTEE };
  const run = await repository.createRun({ ...runInput, operation_key: operationKey, status: 'running', concurrency_guarantee: CONCURRENCY_GUARANTEE });
  return { reused: false, run, concurrency_guarantee: CONCURRENCY_GUARANTEE };
}

async function validateReusedSuccess(repository, run, diagnosisId, uploadId) {
  if (['running', 'committing'].includes(run.status)) {
    return { success: false, in_progress: true, reused: true, completed: false, status: run.status, run_id: run.id, http_status: 202, concurrency_guarantee: CONCURRENCY_GUARANTEE, atomicity_verified: false };
  }
  const freshRun = await repository.getRun(run.id);
  const summary = freshRun?.result_summary || {};
  const [upload, snapshot, manifest, diagnosis] = await Promise.all([
    repository.getUpload(uploadId),
    summary.snapshot_id ? repository.getSnapshot(summary.snapshot_id) : Promise.resolve(null),
    summary.restore_manifest_id ? repository.getRecoveryManifest(summary.restore_manifest_id) : Promise.resolve(null),
    repository.getDiagnosis(diagnosisId),
  ]);
  const valid = freshRun?.status === 'succeeded'
    && upload?.deletion_status === 'tombstoned'
    && upload?.is_current === false
    && snapshot?.status === 'active'
    && snapshot?.financial_processing_run_id === freshRun.id
    && manifest?.status === 'committed'
    && diagnosis?.current_processing_snapshot_id === snapshot?.id
    && summary.snapshot_id === snapshot?.id
    && summary.restore_manifest_id === manifest?.id;
  if (!valid) {
    await repository.blockDiagnosis(diagnosisId, 'REUSED_RUN_INTEGRITY_FAILED');
    return { success: false, reused: true, completed: false, status: 'integrity_failed', error: 'REUSED_RUN_INTEGRITY_FAILED', run_id: freshRun?.id || run.id, http_status: 409, concurrency_guarantee: CONCURRENCY_GUARANTEE, atomicity_verified: false };
  }
  return { success: true, reused: true, completed: true, status: 'succeeded', run_id: freshRun.id, snapshot_id: snapshot.id, restore_manifest_id: manifest.id, concurrency_guarantee: CONCURRENCY_GUARANTEE, atomicity_verified: false };
}

async function runDeleteWorkflow({ repository, diagnosisId, uploadId, actor, failurePoint }) {
  const diagnosisBefore = await repository.getDiagnosis(diagnosisId);
  const uploadBefore = await repository.getUpload(uploadId);
  const operationKey = repository.operationKey(diagnosisBefore, uploadBefore);
  const begun = await beginOrReuseBestEffort(repository, operationKey, { diagnosis_id: diagnosisId, upload_id: uploadId, actor });
  if (begun.error) return begun;
  if (begun.reused) return validateReusedSuccess(repository, begun.run, diagnosisId, uploadId);

  const run = begun.run;
  await repository.updateUpload(uploadId, { deletion_status: 'pending_delete', deletion_run_id: run.id });
  const entities = await repository.captureDerivatives(uploadId, DERIVATIVE_ENTITIES);
  const manifestJson = { version: 1, workflow_version: DELETE_WORKFLOW_VERSION, financial_upload_id: uploadId, financial_diagnosis_id: diagnosisId, created_at: repository.now(), entities };
  const manifestChecksum = await canonicalChecksum(manifestJson);
  const manifest = await repository.createRecoveryManifest({ diagnosisId, uploadId, runId: run.id, status: 'prepared', manifest_json: manifestJson, manifest_checksum: manifestChecksum });
  let deletionStarted = false;
  try {
    const persistedManifest = await repository.getRecoveryManifest(manifest.id);
    if (await canonicalChecksum(persistedManifest.manifest_json) !== persistedManifest.manifest_checksum) throw new Error('RECOVERY_MANIFEST_CHECKSUM_MISMATCH');
    if (failurePoint === 'after_manifest') throw new Error(failurePoint);
    await repository.updateRecoveryManifest(manifest.id, { status: 'deleting' });
    deletionStarted = true;
    for (let index = 0; index < DERIVATIVE_ENTITIES.length; index += 1) {
      await repository.deleteDerivativeEntity(DERIVATIVE_ENTITIES[index], uploadId);
      if (index === 0 && failurePoint === 'after_first_delete') throw new Error(failurePoint);
    }
    if (failurePoint === 'after_all_deletes') throw new Error(failurePoint);
    const remaining = await repository.captureDerivatives(uploadId, DERIVATIVE_ENTITIES);
    if (Object.values(remaining).some((items) => items.length > 0)) throw new Error('DERIVATIVE_DELETE_POSTCONDITION_FAILED');

    const diagnosisAfter = await repository.updateDiagnosisForDeletion(diagnosisId, uploadId);
    if (failurePoint === 'after_diagnosis_update') throw new Error(failurePoint);
    const integrity = await repository.checkIntegrity(diagnosisId);
    if (!integrity?.is_healthy) throw new Error(integrity?.error || 'INTEGRITY_BLOCKED');
    if (failurePoint === 'after_integrity') throw new Error(failurePoint);

    await repository.updateRun(run.id, { status: 'committing', result_summary: { success: false, commit_pending: true, upload_ids: [uploadId], restore_manifest_id: manifest.id, concurrency_guarantee: CONCURRENCY_GUARANTEE, atomicity_verified: false } });
    await repository.updateUpload(uploadId, { deletion_status: 'tombstoned', is_current: false, tombstoned_at: repository.now() });
    const committedUpload = await repository.getUpload(uploadId);
    if (committedUpload.deletion_status !== 'tombstoned' || committedUpload.is_current !== false) throw new Error('TOMBSTONE_POSTCONDITION_FAILED');
    if (failurePoint === 'after_tombstone_before_snapshot') throw new Error(failurePoint);

    const snapshot = await repository.createSnapshot(diagnosisId, run.id);
    if (!snapshot?.id) throw new Error('SNAPSHOT_REQUIRED');
    const [persistedSnapshot, committedDiagnosis] = await Promise.all([repository.getSnapshot(snapshot.id), repository.getDiagnosis(diagnosisId)]);
    const tombstonedSource = persistedSnapshot?.source_manifest?.upload_checksums?.find((item) => item.id === uploadId);
    const deletedOutputPresent = [...(persistedSnapshot?.output_manifest?.statement_lines || []), ...(persistedSnapshot?.output_manifest?.indicators || [])]
      .some((item) => String(item.key || '').includes(`|${uploadId}|`));
    if (!persistedSnapshot
      || persistedSnapshot.status !== 'active'
      || persistedSnapshot.financial_processing_run_id !== run.id
      || persistedSnapshot.previous_snapshot_id !== (diagnosisBefore.current_processing_snapshot_id || null)
      || committedDiagnosis.current_processing_snapshot_id !== persistedSnapshot.id
      || tombstonedSource?.deletion_status !== 'tombstoned'
      || tombstonedSource?.is_current !== false
      || deletedOutputPresent) throw new Error('DELETE_SNAPSHOT_POSTCONDITION_FAILED');
    if (failurePoint === 'after_snapshot' || failurePoint === 'after_snapshot_before_manifest_committed') throw new Error(failurePoint);

    await repository.updateRecoveryManifest(manifest.id, { status: 'committed' });
    if (failurePoint === 'after_manifest_committed_before_run_close') throw new Error(failurePoint);
    await repository.updateRun(run.id, { status: 'succeeded', completed_at: repository.now(), result_summary: { success: true, tombstoned: true, snapshot_id: persistedSnapshot.id, restore_manifest_id: manifest.id, concurrency_guarantee: CONCURRENCY_GUARANTEE, atomicity_verified: false } });
    return { success: true, status: 'succeeded', run_id: run.id, snapshot_id: persistedSnapshot.id, restore_manifest_id: manifest.id, diagnosis: diagnosisAfter, concurrency_guarantee: CONCURRENCY_GUARANTEE, atomicity_verified: false };
  } catch (error) {
    if (!deletionStarted) return repository.failBeforeDelete({ run, uploadId, manifest, error, concurrencyGuarantee: CONCURRENCY_GUARANTEE });
    try {
      await repository.updateRecoveryManifest(manifest.id, { status: 'restoring' });
      const recoverySource = await repository.getRecoveryManifest(manifest.id);
      if (await canonicalChecksum(recoverySource.manifest_json) !== recoverySource.manifest_checksum) throw new Error('RECOVERY_MANIFEST_CHECKSUM_MISMATCH');
      await repository.restoreDerivatives(uploadId, recoverySource.manifest_json.entities, DERIVATIVE_ENTITIES);
      const restored = await repository.captureDerivatives(uploadId, DERIVATIVE_ENTITIES);
      const beforeChecksum = await canonicalChecksum(recoverySource.manifest_json.entities);
      const afterChecksum = await canonicalChecksum(restored);
      const countsMatch = DERIVATIVE_ENTITIES.every((name) => restored[name].length === recoverySource.manifest_json.entities[name].length);
      if (!countsMatch || beforeChecksum !== afterChecksum) throw new Error('RECOVERY_POSTCONDITION_FAILED');
      await repository.invalidateSnapshotsForRun(run.id, 'OPERATION_ROLLED_BACK');
      await repository.restoreDiagnosis(diagnosisId, diagnosisBefore);
      await repository.updateUpload(uploadId, { is_current: uploadBefore.is_current, deletion_status: 'delete_failed', tombstoned_at: null, delete_error: { error: error.message } });
      await repository.updateRun(run.id, { status: 'partial_failed', completed_at: repository.now(), error_details: { error: error.message }, result_summary: { success: false, recovery_executed: true, recovery_verified: true, concurrency_guarantee: CONCURRENCY_GUARANTEE, atomicity_verified: false } });
      await repository.updateRecoveryManifest(manifest.id, { status: 'restored', restored_at: repository.now(), restore_error: null });
      return { success: false, status: 'partial_failed', http_status: 500, recovery_executed: true, recovery_verified: true, run_id: run.id, restore_manifest_id: manifest.id, concurrency_guarantee: CONCURRENCY_GUARANTEE };
    } catch (recoveryError) {
      await repository.blockDiagnosis(diagnosisId, recoveryError.message);
      await repository.updateUpload(uploadId, { deletion_status: 'delete_failed', delete_error: { error: error.message, recovery_error: recoveryError.message } });
      await repository.updateRun(run.id, { status: 'partial_failed', completed_at: repository.now(), error_details: { error: error.message, recovery_error: recoveryError.message }, result_summary: { success: false, recovery_executed: true, recovery_verified: false, concurrency_guarantee: CONCURRENCY_GUARANTEE, atomicity_verified: false } });
      await repository.updateRecoveryManifest(manifest.id, { status: 'recovery_failed', restore_error: { error: recoveryError.message } });
      return { success: false, status: 'recovery_failed', http_status: 500, recovery_executed: true, recovery_verified: false, run_id: run.id, restore_manifest_id: manifest.id, concurrency_guarantee: CONCURRENCY_GUARANTEE };
    }
  }
}
// </generated-delete-workflow>

function createBase44DeleteRepository(base44, diagnosis, upload, actor) {
  const capture = async (uploadId, names) => {
    const entities = {};
    for (const name of names) {
      const rows = await base44.asServiceRole.entities[name].filter({ financial_upload_id: uploadId }, 'id', 5000);
      if (!Array.isArray(rows)) throw new Error(`MANIFEST_SOURCE_UNAVAILABLE:${name}`);
      if (rows.length >= 5000) throw new Error(`MANIFEST_LIMIT_REACHED:${name}`);
      entities[name] = rows;
    }
    return entities;
  };
  return {
    now: () => new Date().toISOString(),
    operationKey: (d, u) => `${d.tenant_id}|${d.id}|${u.id}|delete_upload|${u.source_entity_id || ''}|${u.source_period || ''}|${u.input_checksum || ''}`,
    getDiagnosis: (id) => base44.asServiceRole.entities.FinancialDiagnosis.get(id),
    getUpload: (id) => base44.asServiceRole.entities.FinancialUpload.get(id),
    getRun: (id) => base44.asServiceRole.entities.FinancialProcessingRun.get(id),
    getSnapshot: (id) => base44.asServiceRole.entities.FinancialProcessingSnapshot.get(id),
    findRuns: (key) => base44.asServiceRole.entities.FinancialProcessingRun.filter({ operation_key: key }, 'id', 50),
    createRun: (data) => base44.asServiceRole.entities.FinancialProcessingRun.create({ tenant_id: diagnosis.tenant_id, financial_diagnosis_id: data.diagnosis_id, financial_upload_id: data.upload_id, operation_type: 'delete_upload', operation_key: data.operation_key, status: data.status, concurrency_guarantee: data.concurrency_guarantee, started_at: new Date().toISOString(), triggered_by: actor, source_entity_id: upload.source_entity_id || null, source_period: upload.source_period || null, input_checksum: upload.input_checksum || null }),
    updateRun: (id, patch) => base44.asServiceRole.entities.FinancialProcessingRun.update(id, patch),
    updateUpload: (id, patch) => base44.asServiceRole.entities.FinancialUpload.update(id, patch),
    captureDerivatives: capture,
    createRecoveryManifest: (data) => base44.asServiceRole.entities.FinancialDeletionRecoveryManifest.create({ tenant_id: diagnosis.tenant_id, financial_diagnosis_id: data.diagnosisId, financial_upload_id: data.uploadId, processing_run_id: data.runId, status: data.status, manifest_json: data.manifest_json, manifest_checksum: data.manifest_checksum, created_at: new Date().toISOString() }),
    getRecoveryManifest: (id) => base44.asServiceRole.entities.FinancialDeletionRecoveryManifest.get(id),
    updateRecoveryManifest: (id, patch) => base44.asServiceRole.entities.FinancialDeletionRecoveryManifest.update(id, patch),
    deleteDerivativeEntity: async (name, uploadId) => {
      const rows = await base44.asServiceRole.entities[name].filter({ financial_upload_id: uploadId }, 'id', 5000);
      for (let offset = 0; offset < rows.length; offset += 20) {
        const results = await Promise.allSettled(rows.slice(offset, offset + 20).map((row) => base44.asServiceRole.entities[name].delete(row.id)));
        if (results.some((item) => item.status === 'rejected')) throw new Error(`DERIVATIVE_DELETE_FAILED:${name}`);
      }
    },
    updateDiagnosisForDeletion: async (diagnosisId, uploadId) => {
      const active = (await base44.asServiceRole.entities.FinancialUpload.filter({ financial_diagnosis_id: diagnosisId, is_current: true }, '-created_date', 500)).filter((item) => item.id !== uploadId && item.deletion_status !== 'tombstoned');
      const valid = active.filter((item) => ['validated', 'processed'].includes(item.upload_status));
      const periods = valid.map((item) => normalizePeriod(item.source_period)).filter(Boolean).sort();
      await base44.asServiceRole.entities.FinancialDiagnosis.update(diagnosisId, { current_upload_id: valid[0]?.id || active[0]?.id || null, first_period: periods[0] || null, last_period: periods[periods.length - 1] || null, months_count: periods.length ? new Set(periods).size * (MONTHS_PER_PERIOD[diagnosis.periodicidade || 'mensal'] || 1) : null });
      return base44.asServiceRole.entities.FinancialDiagnosis.get(diagnosisId);
    },
    checkIntegrity: async (diagnosisId) => { const response = await base44.functions.invoke('checkFinancialDiagnosisIntegrity', { financial_diagnosis_id: diagnosisId }); return response?.data || response; },
    createSnapshot: async (diagnosisId, runId) => { const response = await base44.functions.invoke('createFinancialProcessingSnapshot', { financial_diagnosis_id: diagnosisId, processing_run_id: runId }); const data = response?.data || response; return data?.snapshot_id ? { ...data, id: data.snapshot_id } : data; },
    restoreDerivatives: async (uploadId, entities, names) => {
      for (const name of names) {
        const current = await base44.asServiceRole.entities[name].filter({ financial_upload_id: uploadId }, 'id', 5000);
        const signatures = new Set(current.map((row) => JSON.stringify(canonicalize(row))));
        const missing = (entities[name] || []).filter((row) => !signatures.has(JSON.stringify(canonicalize(row)))).map(stripAutoFields);
        for (let offset = 0; offset < missing.length; offset += 500) await base44.asServiceRole.entities[name].bulkCreate(missing.slice(offset, offset + 500));
      }
    },
    invalidateSnapshotsForRun: async (runId, reason) => {
      const snapshots = await base44.asServiceRole.entities.FinancialProcessingSnapshot.filter({ financial_processing_run_id: runId }, '-version_number', 100);
      for (const snapshot of snapshots.filter((item) => item.status === 'active')) await base44.asServiceRole.entities.FinancialProcessingSnapshot.update(snapshot.id, { status: 'invalid', invalid_reason: reason, invalidated_at: new Date().toISOString(), invalidated_by_run_id: runId });
    },
    restoreDiagnosis: (id, value) => base44.asServiceRole.entities.FinancialDiagnosis.update(id, { current_upload_id: value.current_upload_id || null, first_period: value.first_period || null, last_period: value.last_period || null, months_count: value.months_count ?? null, current_processing_snapshot_id: value.current_processing_snapshot_id || null, integrity_status: value.integrity_status || 'unknown', integrity_blocking_count: value.integrity_blocking_count || 0, integrity_warning_count: value.integrity_warning_count || 0, integrity_checked_at: value.integrity_checked_at || null }),
    blockDiagnosis: (id) => base44.asServiceRole.entities.FinancialDiagnosis.update(id, { integrity_status: 'blocked', integrity_blocking_count: Math.max(1, Number(diagnosis.integrity_blocking_count || 0)), integrity_checked_at: new Date().toISOString() }),
    failBeforeDelete: async ({ run, uploadId, manifest, error, concurrencyGuarantee }) => {
      await base44.asServiceRole.entities.FinancialUpload.update(uploadId, { deletion_status: 'delete_failed', delete_error: { error: error.message } });
      await base44.asServiceRole.entities.FinancialProcessingRun.update(run.id, { status: 'failed', completed_at: new Date().toISOString(), error_details: { error: error.message }, result_summary: { success: false, recovery_executed: false, recovery_verified: false, concurrency_guarantee: concurrencyGuarantee } });
      await base44.asServiceRole.entities.FinancialDeletionRecoveryManifest.update(manifest.id, { status: 'prepared', restore_error: { error: error.message } });
      return { success: false, status: 'failed', http_status: 500, recovery_executed: false, recovery_verified: false, concurrency_guarantee: concurrencyGuarantee };
    },
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });
    if (!ALLOWED_DELETE_ROLES.has(appRole)) return Response.json({ error: 'Permissão insuficiente para operação destrutiva' }, { status: 403 });
    const { financial_diagnosis_id, financial_upload_id, failure_point = null } = await req.json();
    if (!financial_diagnosis_id || !financial_upload_id) return Response.json({ error: 'financial_diagnosis_id e financial_upload_id são obrigatórios' }, { status: 400 });
    const [diagnosis, upload] = await Promise.all([base44.asServiceRole.entities.FinancialDiagnosis.get(financial_diagnosis_id), base44.asServiceRole.entities.FinancialUpload.get(financial_upload_id)]);
    if (!diagnosis || !upload) return Response.json({ error: 'Diagnóstico ou upload não encontrado' }, { status: 404 });
    if (appRole !== 'hq_admin' && diagnosis.tenant_id !== user.tenant_id) return Response.json({ error: 'Forbidden: diagnóstico não pertence ao seu tenant' }, { status: 403 });
    if (upload.financial_diagnosis_id !== financial_diagnosis_id) return Response.json({ error: 'Upload não pertence a este diagnóstico' }, { status: 400 });
    const repository = createBase44DeleteRepository(base44, diagnosis, upload, user.email);
    const result = await runDeleteWorkflow({ repository, diagnosisId: financial_diagnosis_id, uploadId: financial_upload_id, actor: user.email, failurePoint: failure_point });
    return Response.json(result, { status: result.http_status || 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});