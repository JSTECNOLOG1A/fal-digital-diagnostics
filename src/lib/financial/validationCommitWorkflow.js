export async function commitValidationRun({ repository, previousState, runId, checksum, summary, hasBlocker, expectedCount }) {
  const nextStatus = hasBlocker ? 'validation_failed' : 'validated';
  const now = new Date().toISOString();
  let pointerCommitted = false;
  try {
    if (expectedCount > 0) await repository.persistCandidates();
    const candidates = await repository.count(runId, 'candidate');
    if (candidates !== expectedCount) throw new Error('VALIDATION_CANDIDATE_COUNT_MISMATCH');
    await repository.promoteCandidates(runId, now);
    const active = await repository.count(runId, 'active');
    if (active !== expectedCount) throw new Error('VALIDATION_PROMOTION_COUNT_MISMATCH');
    await repository.markCommitting(runId);
    await repository.closeRun({ runId, summary, uploadStatus: nextStatus, diagnosisStatus: nextStatus, resultsCount: expectedCount });
    await repository.updatePointer({ runId, checksum, uploadStatus: nextStatus, diagnosisStatus: nextStatus, summary, validatedAt: now });
    const pointer = await repository.readPointer();
    if (pointer.runId !== runId || pointer.uploadStatus !== nextStatus || pointer.diagnosisStatus !== nextStatus) throw new Error('VALIDATION_POINTER_POSTCONDITION_FAILED');
    pointerCommitted = true;
    try {
      await repository.supersedePrevious(previousState.current_validation_run_id, runId, now);
    } catch (error) {
      await repository.markCleanupPending(runId, error.message);
    }
    return { runId, uploadStatus: nextStatus, diagnosisStatus: nextStatus, resultsCount: expectedCount };
  } catch (error) {
    if (!pointerCommitted) {
      await repository.invalidateRun(runId, error.message);
      await repository.restorePointer(previousState);
      await repository.failRun(runId, error.message);
    }
    throw error;
  }
}