import { canonicalChecksum, DERIVATIVE_ENTITIES } from '@/lib/financial/deleteFinancialUploadWorkflow';

const clone = (value) => structuredClone(value);
export function createInMemoryDeleteRepository({ failRunLookup = false, failRestore = false, failIntegrity = false, failSnapshot = false, corruptManifest = false } = {}) {
  const state = {
    mutations: 0,
    diagnosis: { id: 'd1', tenant_id: 't1', current_upload_id: 'u1', first_period: '2025-01', last_period: '2025-01', months_count: 1, integrity_status: 'healthy', current_processing_snapshot_id: null },
    uploads: [{ id: 'u1', financial_diagnosis_id: 'd1', is_current: true, deletion_status: 'active', source_period: '2025-01', input_checksum: 'file-hash' }],
    derivatives: Object.fromEntries(DERIVATIVE_ENTITIES.map((name, index) => [name, [{ id: `${name}-1`, financial_upload_id: 'u1', financial_diagnosis_id: 'd1', tenant_id: 't1', logical_key: `key-${index}`, value: index + 1 }]])),
    runs: [], manifests: [], snapshots: [],
  };
  const mutate = () => { state.mutations += 1; };
  return {
    state,
    now: () => '2026-07-14T12:00:00.000Z',
    operationKey: (diagnosis, upload) => `${diagnosis.tenant_id}|${diagnosis.id}|${upload.id}|delete_upload|${upload.input_checksum}`,
    getDiagnosis: async () => clone(state.diagnosis),
    getUpload: async (id) => clone(state.uploads.find((item) => item.id === id)),
    getRun: async (id) => clone(state.runs.find((item) => item.id === id)),
    getSnapshot: async (id) => clone(state.snapshots.find((item) => item.id === id)),
    findRuns: async (key) => { if (failRunLookup) throw new Error('run storage unavailable'); return clone(state.runs.filter((run) => run.operation_key === key)); },
    createRun: async (data) => { mutate(); const row = { id: `run-${state.runs.length + 1}`, ...data }; state.runs.push(row); return clone(row); },
    updateRun: async (id, patch) => { mutate(); Object.assign(state.runs.find((item) => item.id === id), clone(patch)); },
    updateUpload: async (id, patch) => { mutate(); Object.assign(state.uploads.find((item) => item.id === id), clone(patch)); },
    captureDerivatives: async (uploadId, names) => Object.fromEntries(names.map((name) => [name, clone(state.derivatives[name].filter((row) => row.financial_upload_id === uploadId))])),
    createRecoveryManifest: async (data) => { mutate(); const row = { id: `manifest-${state.manifests.length + 1}`, ...clone(data) }; state.manifests.push(row); return clone(row); },
    getRecoveryManifest: async (id) => { const row = clone(state.manifests.find((item) => item.id === id)); if (corruptManifest) row.manifest_json.entities.FinancialStatementLine[0].value = 999; return row; },
    updateRecoveryManifest: async (id, patch) => { mutate(); Object.assign(state.manifests.find((item) => item.id === id), clone(patch)); },
    deleteDerivativeEntity: async (name, uploadId) => { mutate(); state.derivatives[name] = state.derivatives[name].filter((row) => row.financial_upload_id !== uploadId); },
    updateDiagnosisForDeletion: async () => { mutate(); Object.assign(state.diagnosis, { current_upload_id: null, first_period: null, last_period: null, months_count: null }); return clone(state.diagnosis); },
    checkIntegrity: async () => failIntegrity ? ({ is_healthy: false, error: 'INTEGRITY_BLOCKED' }) : ({ is_healthy: true }),
    createSnapshot: async (_diagnosisId, runId) => {
      if (failSnapshot) throw new Error('snapshot unavailable');
      mutate();
      const upload = state.uploads.find((item) => item.id === 'u1');
      const row = {
        id: `snapshot-${state.snapshots.length + 1}`,
        financial_processing_run_id: runId,
        previous_snapshot_id: state.diagnosis.current_processing_snapshot_id,
        status: 'active',
        source_manifest: { upload_checksums: [{ id: upload.id, deletion_status: upload.deletion_status, is_current: upload.is_current }] },
        output_manifest: { statement_lines: [], indicators: [], prepared_lines: [], diagnosis_periods: { first_period: state.diagnosis.first_period, last_period: state.diagnosis.last_period, months_count: state.diagnosis.months_count } },
      };
      state.snapshots.push(row);
      state.diagnosis.current_processing_snapshot_id = row.id;
      return clone(row);
    },
    restoreDerivatives: async (_uploadId, entities, names) => { if (failRestore) throw new Error('restore unavailable'); mutate(); for (const name of names) state.derivatives[name] = clone(entities[name]); },
    invalidateSnapshotsForRun: async (runId, reason) => { mutate(); for (const snapshot of state.snapshots.filter((item) => item.financial_processing_run_id === runId && item.status === 'active')) Object.assign(snapshot, { status: 'invalid', invalid_reason: reason, invalidated_by_run_id: runId, invalidated_at: '2026-07-14T12:00:00.000Z' }); },
    restoreDiagnosis: async (_id, diagnosis) => { mutate(); state.diagnosis = clone(diagnosis); },
    blockDiagnosis: async (_id, message) => { mutate(); Object.assign(state.diagnosis, { integrity_status: 'blocked', integrity_blocking_count: 1, integrity_error: message }); },
    failBeforeDelete: async ({ run, uploadId, manifest, error, concurrencyGuarantee }) => { mutate(); Object.assign(state.uploads.find((item) => item.id === uploadId), { deletion_status: 'delete_failed', delete_error: { error: error.message } }); Object.assign(state.runs.find((item) => item.id === run.id), { status: 'failed', result_summary: { success: false, recovery_executed: false, concurrency_guarantee: concurrencyGuarantee } }); Object.assign(state.manifests.find((item) => item.id === manifest.id), { status: 'prepared', restore_error: { error: error.message } }); return { success: false, status: 'failed', http_status: 500, recovery_executed: false, recovery_verified: false, concurrency_guarantee: concurrencyGuarantee }; },
    checksumState: async () => canonicalChecksum(state.derivatives),
  };
}