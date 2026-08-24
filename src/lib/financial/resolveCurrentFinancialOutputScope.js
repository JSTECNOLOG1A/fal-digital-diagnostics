import { base44 } from '@/api/base44Client';

export async function resolveCurrentFinancialOutputScope(diagnosisId) {
  if (!diagnosisId) throw new Error('CURRENT_FINANCIAL_SNAPSHOT_REQUIRED');
  const response = await base44.functions.invoke('resolveCurrentFinancialOutputScope', { diagnosis_id: diagnosisId });
  const scope = response?.data || response;
  if (scope?.error) throw new Error(scope.error);
  if (!scope?.snapshot_id || !scope?.processing_run_id || scope.snapshot_status !== 'active' || !scope.output_checksum) throw new Error('CURRENT_FINANCIAL_SNAPSHOT_INVALID');
  return scope;
}