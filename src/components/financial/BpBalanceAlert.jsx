/**
 * BpBalanceAlert — Alerta de integridade do Balanço Patrimonial.
 * Verifica se há FinancialValidationResult com code 'BP_NOT_BALANCED'.
 * Exibe alerta vermelho (desequilibrado) ou badge verde (fechado).
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { financialKey } from '@/lib/query-client';
import { useTenant } from '@/components/shared/TenantContext';
import { useCurrentFinancialOutputScope } from '@/lib/hooks/useCurrentFinancialOutputScope';

/**
 * @param {Object} props
 * @param {any=} props.diagnosisId
 */
export default function BpBalanceAlert({ diagnosisId }) {
  const { tenantId } = useTenant();
  const { data:currentScope } = useCurrentFinancialOutputScope(diagnosisId, tenantId);
  const { data: validations = [] } = useQuery({
    queryKey: [...financialKey(tenantId, diagnosisId, 'bp-balance-check'), currentScope?.snapshot_id, currentScope?.processing_run_id],
    // Mesmo ajuste de StatementsTab/ValidationTab (FinancialDiagnosisDetail.jsx):
    // com um upload por período, filtrar por processing_run_id só pegava o
    // build mais recente e fazia esse banner mentir "equilibrado em todos os
    // períodos" checando, na prática, só o último período processado.
    queryFn: () => base44.entities.FinancialValidationResult.filter(
      { financial_diagnosis_id: diagnosisId, publication_status:'active', code: 'BP_NOT_BALANCED' }, 'severity', 50
    ),
    enabled: !!currentScope?.processing_run_id,
  });

  if (validations.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span className="text-xs font-semibold text-emerald-800">Balanço Patrimonial equilibrado</span>
        <span className="text-xs text-emerald-600">— Ativo = Passivo + PL em todos os períodos analisados</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {validations.map((v, i) => (
        <div
          key={v.id || i}
          className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-300 rounded-lg"
        >
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-800">{v.title}</p>
            <p className="text-xs text-red-700 mt-0.5">{v.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}