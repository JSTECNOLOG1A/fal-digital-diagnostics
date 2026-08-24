/**
 * EvolutionTimeline — Linha do tempo automática de evolução IFME™
 * Reutilizável em: Grupo, Empresa, Unidade
 * Props: cycles (ordenados), snapsByCycleId, levelType, levelId
 */
import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

const LEVEL_COLOR = {
  Crítico:     { bg: 'bg-red-500',     text: 'text-red-700',     light: 'bg-red-50 border-red-200' },
  Básico:      { bg: 'bg-amber-500',   text: 'text-amber-700',   light: 'bg-amber-50 border-amber-200' },
  Estruturado: { bg: 'bg-slate-600',   text: 'text-slate-700',   light: 'bg-slate-50 border-slate-200' },
  Avançado:    { bg: 'bg-emerald-500', text: 'text-emerald-700', light: 'bg-emerald-50 border-emerald-200' },
};

/**
 * @param {Object} props
 * @param {any=} props.delta
 */
function DeltaChip({ delta }) {
  if (delta == null) return null;
  if (Math.abs(delta) < 0.5) return (
    <span className="flex items-center gap-0.5 text-slate-400 text-[10px]"><Minus className="w-2.5 h-2.5" /></span>
  );
  if (delta > 0) return (
    <span className="flex items-center gap-0.5 text-emerald-600 text-[10px] font-bold"><TrendingUp className="w-2.5 h-2.5" />+{delta.toFixed(1)}</span>
  );
  return (
    <span className="flex items-center gap-0.5 text-red-500 text-[10px] font-bold"><TrendingDown className="w-2.5 h-2.5" />{delta.toFixed(1)}</span>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.cycles
 * @param {any=} props.snapsByCycleId
 */
export default function EvolutionTimeline({ cycles = [], snapsByCycleId = {}, groupId }) {
  // Ordenar ciclos do mais antigo para mais novo
  const sorted = [...cycles].sort((a, b) => a.cycle_number - b.cycle_number);

  if (sorted.length === 0) return null;

  // Calcular altura relativa para o gráfico de barras
  const scores = sorted.map(c => snapsByCycleId[c.id]?.overall_score).filter(s => s != null);
  const maxScore = scores.length > 0 ? Math.max(...scores, 3) : 3;

  return (
    <div className="fal-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Evolução IFME™</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Histórico por ciclo de análise</p>
        </div>
        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
          {sorted.length} ciclo{sorted.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Gráfico de barras + linha */}
      <div className="flex items-end gap-2 mb-3 min-h-[80px]">
        {sorted.map((cycle, idx) => {
          const snap = snapsByCycleId[cycle.id];
          const score = snap?.overall_score;
          const level = snap?.overall_level;
          const lc = level ? LEVEL_COLOR[level] : null;
          const prevSnap = idx > 0 ? snapsByCycleId[sorted[idx - 1].id] : null;
          const delta = score != null && prevSnap?.overall_score != null
            ? score - prevSnap.overall_score : null;
          const barHeight = score != null ? Math.max((score / maxScore) * 72, 12) : 12;

          const cycleLink = groupId
            ? createPageUrl(`GroupCycleDashboard?cycle_id=${cycle.id}&group_id=${groupId}`)
            : null;

          const inner = (
            <div className="flex flex-col items-center gap-1 flex-1 min-w-[44px] group cursor-pointer">
              {/* Score label */}
              <div className="flex flex-col items-center">
                {score != null && (
                  <span className={`text-xs font-black ${lc?.text || 'text-slate-700'}`}>
                    {score.toFixed(1)}
                  </span>
                )}
                <DeltaChip delta={delta} />
              </div>

              {/* Bar */}
              <div className="w-full flex items-end justify-center">
                <div
                  className={`w-8 rounded-t-md transition-all group-hover:opacity-80 ${lc?.bg || 'bg-slate-200'} ${!score ? 'opacity-30' : ''}`}
                  style={{ height: `${barHeight}px` }}
                />
              </div>

              {/* Cycle label */}
              <div className="text-center">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  cycle.status === 'open'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  C{cycle.cycle_number}
                </span>
                {level && (
                  <p className={`text-[9px] mt-0.5 font-medium ${lc?.text || 'text-slate-400'}`}>
                    {level}
                  </p>
                )}
                {!score && (
                  <p className="text-[9px] text-slate-300 mt-0.5">Sem dados</p>
                )}
              </div>
            </div>
          );

          return cycleLink ? (
            <Link key={cycle.id} to={cycleLink} className="flex-1 min-w-[44px]">
              {inner}
            </Link>
          ) : (
            <div key={cycle.id} className="flex-1 min-w-[44px]">
              {inner}
            </div>
          );
        })}
      </div>

      {/* Linha de referência */}
      <div className="border-t border-dashed border-slate-200 pt-2">
        <div className="flex justify-between text-[9px] text-slate-300">
          <span>Ciclo mais antigo</span>
          <span>Ciclo mais recente →</span>
        </div>
      </div>
    </div>
  );
}