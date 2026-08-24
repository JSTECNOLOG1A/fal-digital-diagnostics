import { base44 } from '@/api/base44Client';

export async function resolveCurrentFinancialSourceOutput(diagnosisId, sourceEntityId, sourcePeriod) {
  if (!diagnosisId || !sourceEntityId || !sourcePeriod) throw new Error('SOURCE_OUTPUT_SCOPE_REQUIRED');
  const response = await base44.functions.invoke('resolveCurrentFinancialSourceOutput', {
    diagnosis_id: diagnosisId,
    source_entity_id: sourceEntityId,
    source_period: sourcePeriod,
  });
  const scope = response?.data || response;
  if (scope?.error) throw new Error(scope.error);
  if (!scope?.snapshot_id || !scope?.processing_run_id || !scope?.output_checksum) throw new Error('SOURCE_OUTPUT_SCOPE_INVALID');
  return scope;
}