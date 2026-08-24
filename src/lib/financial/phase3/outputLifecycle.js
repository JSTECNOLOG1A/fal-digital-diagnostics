export const PUBLICATION_STATUS = Object.freeze({ CANDIDATE:'candidate', ACTIVE:'active', SUPERSEDED:'superseded', INVALID:'invalid' });

export function createCandidate(records, processingRunId) {
  if (!processingRunId) throw new Error('PROCESSING_RUN_REQUIRED');
  return records.map((record) => ({ ...record, processing_run_id: processingRunId, publication_status: PUBLICATION_STATUS.CANDIDATE }));
}

export function validateCandidateCommit({ runId, snapshot, outputs, expectedCounts }) {
  const errors = [];
  if (!snapshot || snapshot.financial_processing_run_id !== runId) errors.push('SNAPSHOT_RUN_MISMATCH');
  if (!snapshot?.output_checksum) errors.push('SNAPSHOT_CHECKSUM_REQUIRED');
  if (outputs.some((item) => item.processing_run_id !== runId || item.publication_status !== PUBLICATION_STATUS.CANDIDATE)) errors.push('CANDIDATE_RUN_MISMATCH');
  for (const [type, count] of Object.entries(expectedCounts || {})) if (outputs.filter((item) => item.output_type === type).length !== count) errors.push(`OUTPUT_COUNT_MISMATCH:${type}`);
  return { valid: errors.length === 0, errors };
}

export function publishLogicalCommit({ activeBefore, candidates, snapshot, runId, committed = false }) {
  const check = validateCandidateCommit({ runId, snapshot, outputs: candidates });
  if (!check.valid) return { committed: false, active: activeBefore, candidates: candidates.map((item) => ({ ...item, publication_status: PUBLICATION_STATUS.INVALID })), errors: check.errors };
  if (!committed) return { committed: false, active: activeBefore, candidates: candidates.map((item) => ({ ...item, publication_status: PUBLICATION_STATUS.INVALID })), errors: ['COMMIT_NOT_CONFIRMED'] };
  return { committed: true, active: candidates.map((item) => ({ ...item, publication_status: PUBLICATION_STATUS.ACTIVE })), previous: activeBefore.map((item) => ({ ...item, publication_status: PUBLICATION_STATUS.SUPERSEDED })), errors: [] };
}