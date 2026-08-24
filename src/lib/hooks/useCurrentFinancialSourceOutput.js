import { useQuery } from '@tanstack/react-query';
import { resolveCurrentFinancialSourceOutput } from '@/lib/financial/resolveCurrentFinancialSourceOutput';

export default function useCurrentFinancialSourceOutput({ tenantId, diagnosisId, sourceEntityId, sourcePeriod, enabled = true }) {
  return useQuery({
    queryKey: ['financial-source-output', tenantId, diagnosisId, sourceEntityId, sourcePeriod],
    queryFn: () => resolveCurrentFinancialSourceOutput(diagnosisId, sourceEntityId, sourcePeriod),
    enabled: Boolean(enabled && diagnosisId && sourceEntityId && sourcePeriod),
  });
}