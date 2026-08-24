export async function commitSourceHeads({ repository, changes, now = new Date().toISOString() }) {
  const committed = [];
  try {
    for (const change of changes) {
      const head = await repository.writeHead({ ...change, updatedAt: now });
      const current = await repository.readHead(change.sourceKey);
      if (!current || current.currentProcessingRunId !== change.currentProcessingRunId || current.currentProcessingSnapshotId !== change.currentProcessingSnapshotId || current.currentOutputChecksum !== change.currentOutputChecksum) {
        throw new Error('SOURCE_OUTPUT_HEAD_POSTCONDITION_FAILED');
      }
      committed.push({ change, head });
    }
  } catch (error) {
    await repository.rollbackHeads(committed);
    throw error;
  }

  try {
    for (const { change } of committed) {
      if (change.previousProcessingRunId && change.previousProcessingRunId !== change.currentProcessingRunId) {
        await repository.cleanupPreviousRun(change);
      }
    }
  } catch (error) {
    await repository.markCleanupPending(error.message);
  }
  return committed;
}