export const DELETE_WORKFLOW_VERSION = 'r6-recovery-v1';
export const CONCURRENCY_GUARANTEE = 'best_effort';
export const DERIVATIVE_ENTITIES = [
  'FinancialStatementLine', 'FinancialTrialBalanceLine', 'FinancialValidationResult',
  'FinancialMappingResolution', 'FinancialIndicatorSnapshot', 'FinancialAlert',
  'FinancialDfcCompositionLine',
];

export function canonicalize(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const excluded = new Set(['id', 'created_date', 'updated_date', 'created_by_id']);
  return Object.fromEntries(Object.keys(value).sort().filter((key) => !excluded.has(key)).map((key) => [key, canonicalize(value[key])]));
}

export async function canonicalChecksum(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(value)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function beginOrReuseBestEffort(repository, operationKey, runInput) {
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

export async function runDeleteWorkflow({ repository, diagnosisId, uploadId, actor, failurePoint }) {
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