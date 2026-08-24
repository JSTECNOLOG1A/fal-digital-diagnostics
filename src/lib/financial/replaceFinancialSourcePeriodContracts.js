export const CONCURRENCY_GUARANTEE = 'best_effort';

export function assertFullIntegrityResponse(response) {
  const data = response?.data || response;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('FULL_INTEGRITY_EMPTY_RESPONSE');
  if (data.is_healthy !== true) throw new Error('FULL_INTEGRITY_NOT_HEALTHY');
  if (!Array.isArray(data.blocking_issues)) throw new Error('FULL_INTEGRITY_UNEXPECTED_FORMAT');
  if (data.blocking_issues.length > 0) throw new Error('FULL_INTEGRITY_BLOCKED');
  return data;
}

export async function lookupReplacementRun(repository, operationKey) {
  try {
    return { status: 200, runs: await repository.findRuns(operationKey), mutation_executed: false };
  } catch (error) {
    return { status: 503, error: 'PROCESSING_RUN_LOOKUP_UNAVAILABLE', detail: error.message, concurrency_guarantee: CONCURRENCY_GUARANTEE, atomicity_verified: false, mutation_executed: false };
  }
}