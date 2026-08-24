import React from 'react';
import { TrendingUp, Shield, Zap, DollarSign, Landmark } from 'lucide-react';

const LEVER_CONFIG = {
  geracao_caixa:         { label: 'Geração de Caixa',                  icon: DollarSign, color: 'emerald', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', bar: 'bg-emerald-500' },
  preservacao_margem:    { label: 'Preservação de Margem',              icon: TrendingUp,  color: 'blue',    bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    bar: 'bg-blue-500'    },
  reducao_risco:         { label: 'Redução de Risco',                   icon: Shield,      color: 'red',     bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     bar: 'bg-red-500'     },
  eficiencia_operacional:{ label: 'Eficiência Operacional',             icon: Zap,         color: 'amber',   bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   bar: 'bg-amber-500'   },
  protecao_patrimonial:  { label: 'Proteção Patrimonial e Continuidade',icon: Landmark,    color: 'violet',  bg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-700',  bar: 'bg-violet-500'  },
};

function clusterLabel(key) {
  return (key || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * FalValueLeverMap
 * Props: valueLeverSummary (from FalDiagnosticSnapshot.value_lever_summary)
 */
export default function FalValueLeverMap({ valueLeverSummary }) {
  if (!valueLeverSummary || Object.keys(valueLeverSummary).length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        <p>Nenhum dado de alavancas disponível.</p>
        <p className="text-xs mt-1">Recalcule o diagnóstico para gerar o Mapa de Alavancas.</p>
        <p className="text-xs mt-1 text-slate-300">Necessário cadastrar vínculos em FalClusterValueLever para ativar este módulo.</p>
      </div>
    );
  }

  // Se todos os potenciais são zero, exibir aviso em vez de barras vazias
  const totalPotential = Object.values(valueLeverSummary).reduce((s, v) => s + (v.total_potential || 0), 0);
  if (totalPotential === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        <p>Alavancas sem potencial calculado.</p>
        <p className="text-xs mt-1">Verifique se há vínculos configurados em FalClusterValueLever para os clusters deste diagnóstico.</p>
      </div>
    );
  }

  // Sort by total_potential desc
  const ranked = Object.entries(valueLeverSummary)
    .map(([key, val]) => ({ key, ...val }))
    .sort((a, b) => (b.total_potential || 0) - (a.total_potential || 0));

  const maxPotential = ranked[0]?.total_potential || 1;

  return (
    <div className="space-y-3">
      {ranked.map((lever, idx) => {
        const cfg = LEVER_CONFIG[lever.key] || {};
        const Icon = cfg.icon || TrendingUp;
        const pct = Math.round(((lever.total_potential || 0) / maxPotential) * 100);
        const topClusters = (lever.top_clusters || []).slice(0, 3);

        return (
          <div
            key={lever.key}
            className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${cfg.bar}`}>
                  {idx + 1}
                </div>
                <div className={`p-1.5 rounded-lg ${cfg.bg}`}>
                  <Icon className={`w-4 h-4 ${cfg.text}`} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${cfg.text}`}>{cfg.label || lever.key}</p>
                  {topClusters.length > 0 && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      principais drivers: {topClusters.map(c => clusterLabel(c.cluster_key || c)).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-lg font-bold tabular-nums ${cfg.text}`}>{(lever.total_potential || 0).toFixed(1)}</p>
                <p className="text-[10px] text-slate-400">potencial</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-white/70 rounded-full overflow-hidden mt-1">
              <div className={`h-full ${cfg.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}