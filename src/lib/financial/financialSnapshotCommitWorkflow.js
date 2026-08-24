export async function commitFinancialSnapshot({ repository, runId, snapshotId, expectedCounts, pointer, previousState }) {
  let pointerCommitted = false;
  try {
    const snapshot = await repository.readSnapshot(snapshotId);
    if (!snapshot || snapshot.status !== 'candidate' || snapshot.processingRunId !== runId || !snapshot.outputChecksum) throw new Error('SNAPSHOT_POSTCONDITION_FAILED');
    await repository.validateOutputs(runId, expectedCounts, 'candidate');
    await repository.promoteOutputs(runId);
    await repository.validateOutputs(runId, expectedCounts, 'active');
    await repository.activateSnapshot(snapshotId);
    await repository.succeedRun(runId, snapshot.outputChecksum);
    await repository.updatePointer(pointer);
    const persistedPointer = await repository.readPointer();
    if (!repository.pointerMatches(persistedPointer, pointer)) throw new Error('SNAPSHOT_POINTER_POSTCONDITION_FAILED');
    pointerCommitted = true;
    try {
      await repository.cleanupPrevious(previousState);
    } catch (error) {
      await repository.markCleanupPending(runId, error.message);
    }
    return snapshot;
  } catch (error) {
    if (!pointerCommitted) {
      await repository.invalidateOutputs(runId, error.message);
      await repository.invalidateSnapshot(snapshotId, error.message);
      await repository.restorePointer(previousState);
      await repository.failRun(runId, error.message);
    }
    throw error;
  }
}