import { describe, expect, it } from 'vitest';
import { commitValidationRun } from '@/lib/financial/validationCommitWorkflow';

function createRepository(failAt = null) {
  const state = { pointer: { runId: 'old', uploadStatus: 'validated', diagnosisStatus: 'validated' }, candidates: 0, active: 0, invalid: 0, run: 'running', cleanupPending: false, previous: 'old' };
  const fail = (stage) => { if (failAt === stage) throw new Error(stage); };
  return {
    state,
    async persistCandidates() { state.candidates = 2; fail('persist'); },
    async count(runId, status) { return status === 'candidate' ? state.candidates : status === 'active' ? state.active : state.invalid; },
    async promoteCandidates() { fail('promote'); state.active = state.candidates; state.candidates = 0; },
    async markCommitting() { fail('committing'); state.run = 'committing'; },
    async updatePointer(data) { fail('pointer'); state.pointer = { runId: data.runId, uploadStatus: data.uploadStatus, diagnosisStatus: data.diagnosisStatus }; },
    async readPointer() { fail('reread'); return state.pointer; },
    async closeRun() { fail('close'); state.run = 'succeeded'; },
    async supersedePrevious() { fail('supersede'); state.previous = 'superseded'; },
    async markCleanupPending() { state.cleanupPending = true; },
    async invalidateRun() { state.invalid += state.candidates + state.active; state.candidates = 0; state.active = 0; },
    async restorePointer(previous) { state.pointer = { runId: previous.current_validation_run_id, uploadStatus: previous.upload_status, diagnosisStatus: previous.diagnosis_status }; },
    async failRun() { state.run = 'partial_failed'; },
  };
}

const previousState = { current_validation_run_id: 'old', current_validation_checksum: 'old-hash', validated_at: '2026-01-01T00:00:00Z', upload_status: 'validated', diagnosis_status: 'validated' };
const request = (repository, expectedCount = 2) => commitValidationRun({ repository, previousState, runId: 'new', checksum: 'new-hash', summary: { info: 2 }, hasBlocker: false, expectedCount });

describe('R5 validation commit fail-closed', () => {
  for (const stage of ['persist', 'promote', 'committing', 'close', 'pointer', 'reread']) {
    it(`preserves the previous pointer when ${stage} fails`, async () => {
      const repository = createRepository(stage);
      await expect(request(repository)).rejects.toThrow(stage);
      expect(repository.state.pointer.runId).toBe('old');
      expect(repository.state.active).toBe(0);
      expect(repository.state.candidates).toBe(0);
      expect(repository.state.invalid).toBeGreaterThan(0);
      expect(repository.state.run).toBe('partial_failed');
    });
  }
  it('keeps the old pointer when closing the run fails before publication', async () => {
    const repository = createRepository('close');
    await expect(request(repository)).rejects.toThrow('close');
    expect(repository.state.pointer.runId).toBe('old');
    expect(repository.state.active).toBe(0);
    expect(repository.state.invalid).toBeGreaterThan(0);
  });
  it('accepts a validation with zero findings without artificial records', async () => {
    const repository = createRepository();
    await expect(request(repository, 0)).resolves.toMatchObject({ resultsCount: 0 });
    expect(repository.state.active).toBe(0);
    expect(repository.state.pointer.runId).toBe('new');
  });
  it('keeps the new set active and flags cleanup after a post-pointer supersede failure', async () => {
    const repository = createRepository('supersede');
    await expect(request(repository)).resolves.toMatchObject({ runId: 'new' });
    expect(repository.state.pointer.runId).toBe('new');
    expect(repository.state.active).toBe(2);
    expect(repository.state.run).toBe('succeeded');
    expect(repository.state.cleanupPending).toBe(true);
  });
});