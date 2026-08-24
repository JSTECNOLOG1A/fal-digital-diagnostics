import { describe, it, expect } from 'vitest';
import { canonicalChecksum, runDeleteWorkflow } from '@/lib/financial/deleteFinancialUploadWorkflow';
import { createInMemoryDeleteRepository } from '@/lib/financial/testing/createInMemoryDeleteRepository';

const lateFailures = ['after_first_delete', 'after_all_deletes', 'after_diagnosis_update', 'after_integrity', 'after_tombstone_before_snapshot', 'after_snapshot_before_manifest_committed', 'after_manifest_committed_before_run_close'];

describe('R6-DEL-RECOVERY — workflow produtivo por adapter', () => {
  it('commita tombstone, snapshot, run e restore manifest', async () => {
    const repository = createInMemoryDeleteRepository();
    const result = await runDeleteWorkflow({ repository, diagnosisId: 'd1', uploadId: 'u1', actor: 'admin' });
    expect(result).toMatchObject({ success: true, status: 'succeeded', concurrency_guarantee: 'best_effort', atomicity_verified: false });
    expect(repository.state.uploads[0]).toMatchObject({ deletion_status: 'tombstoned', is_current: false });
    expect(Object.values(repository.state.derivatives).every((rows) => rows.length === 0)).toBe(true);
    expect(repository.state.runs[0].status).toBe('succeeded');
    expect(repository.state.snapshots).toHaveLength(1);
    expect(repository.state.snapshots[0]).toMatchObject({
      status: 'active',
      financial_processing_run_id: repository.state.runs[0].id,
      source_manifest: { upload_checksums: [{ id: 'u1', deletion_status: 'tombstoned', is_current: false }] },
      output_manifest: { statement_lines: [], indicators: [], diagnosis_periods: { first_period: null, last_period: null, months_count: null } },
    });
    expect(repository.state.diagnosis.current_processing_snapshot_id).toBe(repository.state.snapshots[0].id);
    expect(repository.state.manifests[0].status).toBe('committed');
  });

  it('falha após manifesto sem executar recovery desnecessário', async () => {
    const repository = createInMemoryDeleteRepository();
    const result = await runDeleteWorkflow({ repository, diagnosisId: 'd1', uploadId: 'u1', actor: 'admin', failurePoint: 'after_manifest' });
    expect(result).toMatchObject({ status: 'failed', recovery_executed: false });
    expect(Object.values(repository.state.derivatives).every((rows) => rows.length === 1)).toBe(true);
  });

  it.each(lateFailures)('restaura counts e checksums na falha %s', async (failurePoint) => {
    const repository = createInMemoryDeleteRepository();
    const before = await canonicalChecksum(repository.state.derivatives);
    const diagnosisBefore = structuredClone(repository.state.diagnosis);
    const result = await runDeleteWorkflow({ repository, diagnosisId: 'd1', uploadId: 'u1', actor: 'admin', failurePoint });
    expect(result).toMatchObject({ status: 'partial_failed', recovery_executed: true, recovery_verified: true });
    expect(await canonicalChecksum(repository.state.derivatives)).toBe(before);
    expect(repository.state.diagnosis).toEqual(diagnosisBefore);
    expect(repository.state.uploads[0]).toMatchObject({ deletion_status: 'delete_failed', is_current: true });
    expect(repository.state.runs[0].status).toBe('partial_failed');
    expect(repository.state.manifests[0].status).toBe('restored');
    const activeSnapshotsForFailedRun = repository.state.snapshots.filter((snapshot) => snapshot.financial_processing_run_id === repository.state.runs[0].id && snapshot.status === 'active');
    expect(activeSnapshotsForFailedRun).toHaveLength(0);
  });

  it.each([
    ['integridade', { failIntegrity: true }],
    ['snapshot', { failSnapshot: true }],
  ])('restaura o estado quando falha a etapa de %s', async (_label, options) => {
    const repository = createInMemoryDeleteRepository(options);
    const before = await canonicalChecksum(repository.state.derivatives);
    const result = await runDeleteWorkflow({ repository, diagnosisId: 'd1', uploadId: 'u1', actor: 'admin' });
    expect(result).toMatchObject({ status: 'partial_failed', recovery_executed: true, recovery_verified: true });
    expect(await canonicalChecksum(repository.state.derivatives)).toBe(before);
    expect(repository.state.snapshots.filter((item) => item.status === 'active')).toHaveLength(0);
  });

  it('falha antes do delete quando o checksum persistido diverge', async () => {
    const repository = createInMemoryDeleteRepository({ corruptManifest: true });
    const result = await runDeleteWorkflow({ repository, diagnosisId: 'd1', uploadId: 'u1', actor: 'admin' });
    expect(result).toMatchObject({ status: 'failed', recovery_executed: false });
    expect(Object.values(repository.state.derivatives).every((rows) => rows.length === 1)).toBe(true);
  });

  it('bloqueia diagnóstico quando a recriação falha', async () => {
    const repository = createInMemoryDeleteRepository({ failRestore: true });
    const result = await runDeleteWorkflow({ repository, diagnosisId: 'd1', uploadId: 'u1', actor: 'admin', failurePoint: 'after_first_delete' });
    expect(result).toMatchObject({ status: 'recovery_failed', http_status: 500, recovery_executed: true, recovery_verified: false });
    expect(repository.state.diagnosis.integrity_status).toBe('blocked');
    expect(repository.state.manifests[0].status).toBe('recovery_failed');
  });

  it.each(['running', 'committing'])('reuse de %s retorna in_progress sem falso sucesso', async (status) => {
    const repository = createInMemoryDeleteRepository();
    repository.state.runs.push({ id: 'run-existing', operation_key: repository.operationKey(repository.state.diagnosis, repository.state.uploads[0]), status });
    const result = await runDeleteWorkflow({ repository, diagnosisId: 'd1', uploadId: 'u1', actor: 'admin' });
    expect(result).toMatchObject({ success: false, in_progress: true, reused: true, completed: false, status, http_status: 202 });
    expect(repository.state.runs).toHaveLength(1);
  });

  it('reuse de succeeded íntegro relê e comprova todas as pós-condições', async () => {
    const repository = createInMemoryDeleteRepository();
    const first = await runDeleteWorkflow({ repository, diagnosisId: 'd1', uploadId: 'u1', actor: 'admin' });
    const second = await runDeleteWorkflow({ repository, diagnosisId: 'd1', uploadId: 'u1', actor: 'admin' });
    expect(first.success).toBe(true);
    expect(second).toMatchObject({ success: true, reused: true, completed: true, run_id: first.run_id, snapshot_id: first.snapshot_id, restore_manifest_id: first.restore_manifest_id });
    expect(repository.state.runs).toHaveLength(1);
  });

  it.each([
    ['sem snapshot', (r) => { r.state.runs[0].result_summary.snapshot_id = null; }],
    ['snapshot invalid', (r) => { r.state.snapshots[0].status = 'invalid'; }],
    ['manifest não committed', (r) => { r.state.manifests[0].status = 'restored'; }],
    ['upload ainda current', (r) => { r.state.uploads[0].is_current = true; }],
    ['diagnóstico aponta para outro snapshot', (r) => { r.state.diagnosis.current_processing_snapshot_id = 'other'; }],
  ])('reuse succeeded rejeita integridade divergente: %s', async (_label, corrupt) => {
    const repository = createInMemoryDeleteRepository();
    await runDeleteWorkflow({ repository, diagnosisId: 'd1', uploadId: 'u1', actor: 'admin' });
    corrupt(repository);
    const result = await runDeleteWorkflow({ repository, diagnosisId: 'd1', uploadId: 'u1', actor: 'admin' });
    expect(result).toMatchObject({ success: false, reused: true, completed: false, status: 'integrity_failed', http_status: 409 });
    expect(repository.state.diagnosis.integrity_status).toBe('blocked');
    expect(repository.state.runs).toHaveLength(1);
  });

  it('partial_failed preserva histórico e inicia nova tentativa best-effort', async () => {
    const repository = createInMemoryDeleteRepository();
    const failed = await runDeleteWorkflow({ repository, diagnosisId: 'd1', uploadId: 'u1', actor: 'admin', failurePoint: 'after_tombstone_before_snapshot' });
    const retried = await runDeleteWorkflow({ repository, diagnosisId: 'd1', uploadId: 'u1', actor: 'admin' });
    expect(failed.status).toBe('partial_failed');
    expect(retried.success).toBe(true);
    expect(repository.state.runs).toHaveLength(2);
    expect(repository.state.runs[0].status).toBe('partial_failed');
    expect(repository.state.runs[1].status).toBe('succeeded');
  });
});