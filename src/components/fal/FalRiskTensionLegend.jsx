import React from 'react';
import { AlertTriangle } from 'lucide-react';

const DIM_LABELS = {
  governanca:         'Governança',
  juridico:           'Jurídico / Societário',
  controles_internos: 'Controles Internos',
  financeiro:         'Financeiro',
  contabil:           'Contábil',
  tributario:         'Fiscal',
  operacional:        'Operacional',
  sistemas:           'Tecnologia / Sistemas',
};

const OFFICIAL_ORDER = [
  'governanca', 'juridico', 'controles_internos', 'financeiro',
  'contabil', 'tributario', 'operacional', 'sistemas',
];

function riskColor(score) {
  if (score === null || score === undefined) return 'text-slate-400';
  if (score >= 2) return 'text-emerald-600';
  if (score >= 1) return 'text-orange-500';
  return 'text-red-600';
}

function riskBg(score) {
  if (score === null || score === undefined) return 'bg-slate-50';
  if (score >= 2) return 'bg-emerald-50';
  if (score >= 1) return 'bg-orange-50';
  return 'bg-red-50';
}

/**
 * FalRiskTensionLegend
 * Props: dimensionRiskSummary (from FalDiagnosticSnapshot)
 */
export default function FalRiskTensionLegend({ dimensionRiskSummary, activeDimensions }) {
  if (!dimensionRiskSummary || Object.keys(dimensionRiskSummary).length === 0) return null;

  const activeSet = new Set(activeDimensions || Object.keys(dimensionRiskSummary));

  const entries = OFFICIAL_ORDER
    .filter(dim => activeSet.has(dim) && dimensionRiskSummary[dim])
    .map(dim => ({ dim, ...dimensionRiskSummary[dim] }));

  if (entries.length === 0) return null;

  const hasCritical = entries.some(e => e.critical_cluster_score !== null && e.critical_cluster_score < 2);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Tensão por Dimensão</p>
        {hasCritical && (
          <span className="text-[10px] text-red-600 flex items-center gap-0.5 font-medium">
            <AlertTriangle className="w-3 h-3" /> Há riscos críticos
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {entries.map(({ dim, dimension_score, critical_cluster_key, critical_cluster_score }) => {
          const isCritical = critical_cluster_score !== null && critical_cluster_score < 2;
          const clusterLabel = critical_cluster_key
            ? critical_cluster_key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
            : '—';

          return (
            <div
              key={dim}
              className={`flex items-start justify-between gap-2 rounded-lg px-3 py-2 border ${riskBg(critical_cluster_score)} ${isCritical ? 'border-red-200' : 'border-transparent'}`}
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">
                  {DIM_LABELS[dim] || dim}
                  {isCritical && (
                    <span className="ml-1 text-red-600 text-[10px] font-semibold">⚠ Risco crítico</span>
                  )}
                </p>
                <p className="text-[10px] text-slate-500 truncate mt-0.5">
                  principal risco: <span className="font-medium text-slate-700">{clusterLabel}</span>
                </p>
              </div>
              <div className="flex flex-col items-end flex-shrink-0">
                <span className={`text-xs font-bold tabular-nums ${riskColor(critical_cluster_score)}`}>
                  {critical_cluster_score !== null ? critical_cluster_score.toFixed(2) : '—'}
                </span>
                <span className="text-[10px] text-slate-400">cluster</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}