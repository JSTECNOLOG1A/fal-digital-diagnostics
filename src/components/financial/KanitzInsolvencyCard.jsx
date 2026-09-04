import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, Check } from 'lucide-react';
import KanitzThermometer, { getKanitzZone, formatKanitzValue } from '@/components/financial/KanitzThermometer';
import KanitzFormulaBreakdown from '@/components/financial/KanitzFormulaBreakdown';
import { financialKey } from '@/lib/query-client';
import { useTenant } from '@/components/shared/TenantContext';
import { useCurrentFinancialOutputScope } from '@/lib/hooks/useCurrentFinancialOutputScope';

const fmtColLabel = (ck) => {
  if (!ck) return '—';
  const a = ck.match(/^A-(\d{4})$/);
  if (a) return a[1];
  const m = ck.match(/^M-(\d{4})-(\d{2})$/);
  return m ? `${m[2]}/${m[1]}` : ck;
};

/**
 * @param {Object} props
 * @param {any=} props.diagnosisId
 */
export default function KanitzInsolvencyCard({ diagnosisId }) {
  const { tenantId } = useTenant();
  const { data:currentScope } = useCurrentFinancialOutputScope(diagnosisId, tenantId);
  const { data: rawIndicators = [] } = useQuery({
    queryKey: [...financialKey(tenantId, diagnosisId, 'indicators-kanitz'), currentScope?.snapshot_id, currentScope?.processing_run_id],
    queryFn: () => base44.entities.FinancialIndicatorSnapshot.filter(
      { financial_diagnosis_id: diagnosisId, publication_status: 'active', indicator_code: 'kanitz_fator_insolvencia' }, '-period', 50
    ),
    enabled: !!currentScope?.processing_run_id,
  });
  const hasPreparedSeries = rawIndicators.some((i) => ['parent', 'consolidated', 'combined'].includes(i.dataset_scope));
  const indicators = hasPreparedSeries ? rawIndicators.filter((i) => i.dataset_scope !== 'individual') : rawIndicators;

  const { data: plAlerts = [] } = useQuery({
    queryKey: [...financialKey(tenantId, diagnosisId, 'validations-kanitz'), currentScope?.snapshot_id, currentScope?.processing_run_id],
    // Mesmo ajuste dos outros consumidores nesta leva — active já é o
    // critério certo de "vale agora" (ver rawIndicators acima, que já
    // seguia esse padrão); processing_run_id só aponta pro último build.
    queryFn: () => base44.entities.FinancialValidationResult.filter(
      { financial_diagnosis_id: diagnosisId, publication_status:'active', code: 'KANITZ_PL_NON_POSITIVE' }, '-created_date', 5
    ),
    enabled: !!currentScope?.processing_run_id,
  });

  const [selectedKeys, setSelectedKeys] = useState(null);

  if (indicators.length === 0) return null;

  // Chave series-aware: distingue parent|consolidated no mesmo período
  const seriesKey = (ind) => `${ind.dataset_scope || 'individual'}|${ind.reporting_entity_id || ''}|${ind.column_key || ind.period}`;
  const seriesLabelOf = (ind) => {
    const ds = ind.dataset_scope || 'individual';
    if (ds === 'parent') return 'Controladora';
    if (ds === 'consolidated') return 'Consolidado';
    if (ds === 'combined') return 'Combinado';
    return '';
  };
  const multiSeries = new Set(indicators.map((i) => `${i.dataset_scope || 'individual'}|${i.reporting_entity_id || ''}`)).size > 1;
  const fmtLabel = (ind) => {
    const base = fmtColLabel(ind.column_key || ind.period);
    const sl = seriesLabelOf(ind);
    return sl && multiSeries ? `${sl} ${base}` : base;
  };

  // Deduplica por série (dataset_scope × reporting_entity_id × período)
  const sorted = [...indicators].sort((a, b) => seriesKey(b).localeCompare(seriesKey(a)));
  const distinct = [];
  const seenKeys = new Set();
  for (const ind of sorted) {
    const k = seriesKey(ind);
    if (!seenKeys.has(k)) { seenKeys.add(k); distinct.push(ind); }
  }

  const latest = distinct[0];

  const effectiveKeys = selectedKeys || [seriesKey(latest)];
  const selectedIndicators = distinct.filter((ind) => effectiveKeys.includes(seriesKey(ind)));
  const isMulti = selectedIndicators.length > 1;

  const togglePeriod = (key) => {
    setSelectedKeys((prev) => {
      const current = prev || [seriesKey(latest)];
      if (current.includes(key)) {
        const next = current.filter((k) => k !== key);
        return next.length === 0 ? current : next;
      }
      return [...current, key];
    });
  };

  return (
    <div className="mt-6 space-y-4">
      {/* Seletor de períodos */}
      <div className="flex items-start gap-2 flex-wrap">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1.5 mr-1">
          Períodos:
        </span>
        {distinct.map(ind => {
          const key = seriesKey(ind);
          const label = fmtLabel(ind);
          const isSelected = effectiveKeys.includes(key);
          return (
            <button
              key={key}
              onClick={() => togglePeriod(key)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all ${
                isSelected
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              }`}
            >
              {isSelected && <Check className="w-3 h-3" />}
              <span>{label}</span>
              {ind.value != null && (
                <span className="tabular-nums font-bold text-slate-700">
                  {ind.value.toFixed(2)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Termômetros — um ou vários lado a lado */}
      <div className={isMulti
        ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        : ""
      }>
        {selectedIndicators.map(ind => (
          <KanitzThermometer
            key={ind.id}
            value={ind.value}
            periodLabel={fmtLabel(ind)}
            compact={isMulti}
            showInterpretation={!isMulti}
          />
        ))}
      </div>

      {/* Comentários automáticos por período (apenas em vista múltipla) */}
      {isMulti && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="text-sm font-bold text-slate-700 mb-3">
            Leitura automática por período
          </h4>
          <div className="space-y-3">
            {selectedIndicators.map(ind => {
              const zone = getKanitzZone(ind.value);
              const ZoneIcon = zone.icon;
              return (
                <div
                  key={ind.id}
                  className="flex items-start gap-3 rounded-xl border p-3"
                  style={{ backgroundColor: zone.bgColor, borderColor: zone.borderColor }}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: '#ffffff', color: zone.color }}
                  >
                    <ZoneIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-700">
                        {fmtLabel(ind)}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: zone.color }}>
                        {zone.label}
                      </span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600">
                        Fator {formatKanitzValue(ind.value)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{zone.description}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-700">
                      <strong>Direcionamento:</strong> {zone.recommendation}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detalhamento da fórmula e composição — colapsável */}
      <KanitzFormulaBreakdown diagnosisId={diagnosisId} selectedIndicators={selectedIndicators} />

      {/* Alerta de PL negativo */}
      {plAlerts.length > 0 && (
        <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Leitura do Kanitz prejudicada por patrimônio líquido negativo. O fator deve ser interpretado com cautela,
            como sinal de fragilidade patrimonial, não como conclusão isolada de insolvência.
          </span>
        </div>
      )}
    </div>
  );
}