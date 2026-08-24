/**
 * ClusterRiskMatrix.jsx
 * Matriz de Risco: Risco Inerente (Y) × Maturidade/Score (X)
 * Cada cluster aparece como um ponto interativo.
 * Ao clicar → painel lateral com diagnóstico completo do cluster.
 */
import React, { useState } from 'react';
import { X, AlertTriangle, ShieldCheck, TrendingDown, Zap } from 'lucide-react';

const INHERENT_RISK_ORDER  = ['critical', 'high', 'medium', 'low'];
const INHERENT_RISK_LABELS = { critical: 'Crítico', high: 'Alto', medium: 'Médio', low: 'Baixo' };

const MATURITY_ZONES = [
  { key: 'low',    label: 'Baixa Maturidade',  min: 0,   max: 1.8 },
  { key: 'mid',    label: 'Maturidade Média',   min: 1.8, max: 2.5 },
  { key: 'high',   label: 'Alta Maturidade',    min: 2.5, max: 3.0 },
];

const RISK_COLORS = {
  critical: { dot: 'bg-red-500',    border: 'border-red-300',    bg: 'bg-red-50',    text: 'text-red-700',    zone: 'bg-red-50/60' },
  high:     { dot: 'bg-orange-500', border: 'border-orange-300', bg: 'bg-orange-50', text: 'text-orange-700', zone: 'bg-orange-50/40' },
  medium:   { dot: 'bg-yellow-400', border: 'border-yellow-300', bg: 'bg-yellow-50', text: 'text-yellow-700', zone: 'bg-yellow-50/30' },
  low:      { dot: 'bg-green-500',  border: 'border-green-300',  bg: 'bg-green-50',  text: 'text-green-700',  zone: 'bg-green-50/20' },
};

function formatKey(key = '') {
  return key.replace(/_cluster$/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function maturityZone(score) {
  if (score === null || score === undefined) return 'low';
  if (score < 1.8) return 'low';
  if (score < 2.5) return 'mid';
  return 'high';
}

/**
 * @param {Object} props
 * @param {any=} props.cluster
 * @param {any=} props.onClose
 */
function ClusterDetailPanel({ cluster, onClose }) {
  if (!cluster) return null;
  const risk = cluster.inherent_risk || 'medium';
  const colors = RISK_COLORS[risk] || RISK_COLORS.medium;

  const priorityColors = {
    critical: 'text-red-600', high: 'text-orange-600', medium: 'text-yellow-600', low: 'text-green-600'
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className={`flex items-start justify-between p-5 border-b ${colors.bg}`}>
          <div>
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${colors.text}`}>
              Risco Inerente: {INHERENT_RISK_LABELS[risk] || risk}
            </span>
            <h3 className="text-base font-bold text-slate-900 mt-0.5">{formatKey(cluster.cluster_key)}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{cluster.dimension_label || cluster.dimension_key}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/60 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 p-5 space-y-4">
          {/* Score + maturidade */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-slate-400 mb-1">Score</p>
              <p className="text-xl font-bold text-slate-900">{cluster.weighted_score?.toFixed(2) ?? 'N/R'}</p>
              <p className="text-[10px] text-slate-400">/3.00</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-slate-400 mb-1">Maturidade</p>
              <p className="text-xs font-bold text-slate-800">{cluster.maturity_v2?.label || cluster.maturity?.label || '—'}</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${colors.bg}`}>
              <p className="text-[10px] text-slate-400 mb-1">Risco Residual</p>
              <p className={`text-xs font-bold ${colors.text}`}>{cluster.residual_risk || '—'}</p>
            </div>
          </div>

          {/* Prioridade de ação */}
          {cluster.action_priority && (
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
              <Zap className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-slate-500">Prioridade de Ação</p>
                <p className={`text-sm font-bold ${priorityColors[cluster.action_priority] || 'text-slate-700'}`}>
                  {cluster.action_priority.charAt(0).toUpperCase() + cluster.action_priority.slice(1)}
                </p>
              </div>
              {cluster.action_priority_score !== undefined && (
                <span className="ml-auto text-xs text-slate-400">score {cluster.action_priority_score?.toFixed(2)}</span>
              )}
            </div>
          )}

          {/* Diagnóstico textual */}
          {cluster.diagnosis && (
            <div className="space-y-3">
              {cluster.diagnosis.summary && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Diagnóstico</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{cluster.diagnosis.summary}</p>
                </div>
              )}
              {cluster.diagnosis.gaps?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Gaps Identificados</p>
                  <ul className="space-y-1">
                    {cluster.diagnosis.gaps.slice(0, 4).map((g, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                        <TrendingDown className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {cluster.diagnosis.focus?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Foco Recomendado</p>
                  <ul className="space-y-1">
                    {cluster.diagnosis.focus.slice(0, 4).map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                        <ShieldCheck className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.clusters
 */
export default function ClusterRiskMatrix({ clusters = [] }) {
  const [selected, setSelected] = useState(null);

  const validClusters = clusters.filter(c => c.weighted_score !== null && c.weighted_score !== undefined);
  const criticalCount = validClusters.filter(c => c.inherent_risk === 'critical' && c.weighted_score < 1.8).length;

  if (validClusters.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-400">
        <p className="text-sm">Nenhum cluster com score disponível para plotar na matriz.</p>
      </div>
    );
  }

  return (
    <>
      {/* Indicador de clusters críticos */}
      {criticalCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <p className="text-xs font-semibold text-red-700">
            Clusters críticos em zona de alto risco: <span className="text-red-900">{criticalCount}</span>
            <span className="font-normal text-red-600"> / {validClusters.length} total</span>
          </p>
        </div>
      )}

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 mb-4">
        {INHERENT_RISK_ORDER.map(r => (
          <div key={r} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${RISK_COLORS[r].dot}`} />
            <span className="text-[10px] text-slate-500">{INHERENT_RISK_LABELS[r]}</span>
          </div>
        ))}
        <span className="text-[10px] text-slate-400 ml-auto">clique num cluster para ver detalhes</span>
      </div>

      {/* Matriz */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        {/* Header X: zonas de maturidade */}
        <div className="grid grid-cols-4 border-b border-slate-200">
          <div className="p-2 text-[10px] font-semibold text-slate-400 uppercase border-r border-slate-200 flex items-end">
            Risco Inerente
          </div>
          {MATURITY_ZONES.map(z => (
            <div key={z.key} className="p-2 text-center border-r border-slate-200 last:border-r-0">
              <p className="text-[10px] font-semibold text-slate-600">{z.label}</p>
              <p className="text-[9px] text-slate-400">{z.min} – {z.max}</p>
            </div>
          ))}
        </div>

        {/* Rows: risco inerente */}
        {INHERENT_RISK_ORDER.map(riskLevel => {
          const colors = RISK_COLORS[riskLevel];
          const rowClusters = validClusters.filter(c => (c.inherent_risk || 'medium') === riskLevel);
          return (
            <div key={riskLevel} className="grid grid-cols-4 border-b border-slate-200 last:border-b-0 min-h-[72px]">
              {/* Rótulo Y */}
              <div className={`p-2 border-r border-slate-200 flex items-center ${colors.bg}`}>
                <span className={`text-[10px] font-bold ${colors.text}`}>{INHERENT_RISK_LABELS[riskLevel]}</span>
              </div>

              {/* Células por zona */}
              {MATURITY_ZONES.map(zone => {
                const cell = rowClusters.filter(c => maturityZone(c.weighted_score) === zone.key);
                // Cor de fundo da célula: combinação risco × maturidade
                const cellBgClass = riskLevel === 'critical' && zone.key === 'low'
                  ? 'bg-red-100'
                  : riskLevel === 'critical' && zone.key === 'mid'
                  ? 'bg-orange-50'
                  : riskLevel === 'high' && zone.key === 'low'
                  ? 'bg-orange-50'
                  : zone.key === 'high'
                  ? 'bg-green-50/30'
                  : '';

                return (
                  <div key={zone.key} className={`p-2 border-r border-slate-200 last:border-r-0 ${cellBgClass}`}>
                    <div className="flex flex-wrap gap-1">
                      {cell.map(c => (
                        <button
                          key={c.cluster_key}
                          onClick={() => setSelected(c)}
                          title={`${formatKey(c.cluster_key)} · Score: ${c.weighted_score?.toFixed(2)}`}
                          className={`group relative flex items-center gap-1 px-1.5 py-0.5 rounded border ${colors.border} ${colors.bg} hover:shadow-sm transition-all`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                          <span className="text-[9px] font-medium text-slate-700 max-w-[80px] truncate">
                            {formatKey(c.cluster_key)}
                          </span>
                          <span className={`text-[9px] font-bold ${colors.text}`}>
                            {c.weighted_score?.toFixed(1)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Painel lateral de detalhe */}
      {selected && (
        <ClusterDetailPanel cluster={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}