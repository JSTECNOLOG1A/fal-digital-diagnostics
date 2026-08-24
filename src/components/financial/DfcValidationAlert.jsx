/**
 * DfcValidationAlert — Banner de validação da DFC (fora da tabela).
 * Verifica se a variação de caixa calculada bate com a variação real do BP.
 * Considera ajustes manuais no cálculo.
 * Verde = DFC fechada; Vermelho = divergência.
 */
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { financialKey } from '@/lib/query-client';
import { useTenant } from '@/components/shared/TenantContext';
import { useCurrentFinancialOutputScope } from '@/lib/hooks/useCurrentFinancialOutputScope';

const periodToColKey = (period) => {
  if (!period) return period;
  if (/^[AMQ]-/.test(period)) return period;
  if (/^\d{4}$/.test(period)) return `A-${period}`;
  if (/^\d{4}-\d{2}$/.test(period)) return `M-${period}`;
  return period;
};

/**
 * @param {Object} props
 * @param {any=} props.diagnosisId
 */
export default function DfcValidationAlert({ diagnosisId }) {
  const { tenantId } = useTenant();
  const { data:currentScope } = useCurrentFinancialOutputScope(diagnosisId, tenantId);
  const { data: dfcLines = [] } = useQuery({
    queryKey: [...financialKey(tenantId, diagnosisId, 'dfc-validation-lines'), currentScope?.snapshot_id, currentScope?.processing_run_id],
    queryFn: () => base44.entities.FinancialStatementLine.filter(
      { financial_diagnosis_id: diagnosisId, processing_run_id:currentScope.processing_run_id, publication_status:'active', statement_code: 'DFC' }, 'id', 200
    ),
    enabled: !!currentScope?.processing_run_id,
  });

  const { differences, periods } = useMemo(() => {
    const lineMap = {};
    const allPeriods = new Set();
    for (const l of dfcLines) {
      const ck = l.canonical_key;
      if (!ck) continue;
      if (!lineMap[ck]) lineMap[ck] = {};
      const colKey = l.column_key || periodToColKey(l.period);
      lineMap[ck][colKey] = l.value;
      allPeriods.add(colKey);
    }
    const sortedPeriods = [...allPeriods].sort((a, b) => {
      const yearA = parseInt(a.match(/A-(\d{4})$/)?.[1] || '0', 10);
      const yearB = parseInt(b.match(/A-(\d{4})$/)?.[1] || '0', 10);
      if (yearA > 0 && yearB > 0) return yearB - yearA;
      return a.localeCompare(b);
    });

    const diffs = {};
    for (const p of sortedPeriods) {
      const caixaInicial = lineMap['dfc_caixa_inicial']?.[p] ?? 0;
      const caixaFinal = lineMap['dfc_caixa_final']?.[p] ?? 0;
      const opBase = lineMap['dfc_caixa_liquido_atividades_operacionais']?.[p] ?? 0;
      const invBase = lineMap['dfc_caixa_liquido_atividades_investimento']?.[p] ?? 0;
      const finBase = lineMap['dfc_caixa_liquido_atividades_financiamento']?.[p] ?? 0;
      const activitiesTotal = opBase + invBase + finBase;
      diffs[p] = (caixaFinal - caixaInicial) - activitiesTotal;
    }
    return { differences: diffs, periods: sortedPeriods };
  }, [dfcLines]);

  if (periods.length === 0) return null;

  const isZero = (v) => Math.abs(v) < 0.005;
  const nonZero = periods.filter(p => !isZero(differences[p] ?? 0));
  const fmt = (v) => {
    const digits = new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(v));
    return v < 0 ? `(${digits})` : digits;
  };
  const fmtPeriod = (p) => {
    const a = p.match(/^A-(\d{4})$/);
    if (a) return a[1];
    const m = p.match(/^M-(\d{4})-(\d{2})$/);
    if (m) return `${m[2]}/${m[1]}`;
    return p;
  };

  if (nonZero.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span className="text-xs font-semibold text-emerald-800">DFC validada</span>
        <span className="text-xs text-emerald-600">— Variação de caixa calculada bate com a variação real do BP em todos os períodos</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {nonZero.map((p) => (
        <div
          key={p}
          className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-300 rounded-lg"
        >
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-800">Divergência na variação de caixa da DFC — {fmtPeriod(p)}</p>
            <p className="text-xs text-red-700 mt-0.5">
              Diferença entre a variação real de caixa (BP) e a DFC calculada: {fmt(differences[p])}. 
              Verifique ajustes manuais, classificações de rubricas ou comparabilidade entre períodos.
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}