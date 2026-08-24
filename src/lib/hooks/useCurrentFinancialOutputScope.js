import { useQuery } from '@tanstack/react-query';
import { resolveCurrentFinancialOutputScope } from '@/lib/financial/resolveCurrentFinancialOutputScope';

export const currentFinancialScopeKey = (tenantId, diagnosisId) => ['financial-current-output-scope', tenantId || null, diagnosisId || null];

export function useCurrentFinancialOutputScope(diagnosisId, tenantId) {
  return useQuery({ queryKey:currentFinancialScopeKey(tenantId, diagnosisId), queryFn:()=>resolveCurrentFinancialOutputScope(diagnosisId), enabled:!!diagnosisId, retry:false });
}