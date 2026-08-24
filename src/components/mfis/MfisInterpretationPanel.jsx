/**
 * MfisInterpretationPanel — Bloco 4
 * Síntese executiva + ponto de alavanca + ordem de intervenção
 */
import React from 'react';
import { Zap, Target, ArrowRight } from 'lucide-react';
import { TENSION_COLOR } from '@/lib/mfisDefinitions';

/**
 * @param {Object} props
 * @param {any=} props.executiveSummary
 * @param {any=} props.dimImpacts
 * @param {any=} props.crossings
 */
export default function MfisInterpretationPanel({ executiveSummary, dimImpacts = [], crossings = [] }) {
  const leverage = dimImpacts.find(d => d.is_systemic_leverage_point);

  // Ordem de intervenção: dimensões ordenadas por leverage_score desc
  const interventionOrder = [...dimImpacts]
    .filter(d => d.fragile_crossings_count > 0)
    .sort((a, b) => b.leverage_score - a.leverage_score)
    .slice(0, 4);

  if (!executiveSummary && !leverage) return null;

  return (
    <div className="space-y-4">
      {/* Síntese executiva */}
      {executiveSummary && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Síntese Diagnóstica</h3>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{executiveSummary}</p>
        </div>
      )}

      {/* Ponto de alavanca */}
      {leverage && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-indigo-500" />
            <h3 className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Ponto de Alavanca Sistêmica</h3>
          </div>
          <p className="text-sm font-bold text-indigo-800 mb-1">{leverage.dimension_label}</p>
          <p className="text-xs text-indigo-700 leading-relaxed">{leverage.systemic_summary}</p>
        </div>
      )}

      {/* Ordem de intervenção */}
      {interventionOrder.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Ordem Sugerida de Intervenção</h3>
          <div className="space-y-2">
            {interventionOrder.map((d, i) => {
              const worstCrossing = [...crossings]
                .filter(c => c.dimension_a_key === d.dimension_key || c.dimension_b_key === d.dimension_key)
                .sort((a, b) => a.cross_score_final - b.cross_score_final)[0];
              const colors = worstCrossing ? TENSION_COLOR[worstCrossing.tension_level] : TENSION_COLOR.alerta;

              return (
                <div key={d.dimension_key} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className={`flex-1 flex items-center justify-between p-2.5 rounded-lg border ${colors.bg} ${colors.border}`}>
                    <div>
                      <p className={`text-sm font-semibold ${colors.text}`}>{d.dimension_label}</p>
                      <p className="text-[11px] text-slate-500">
                        {d.fragile_crossings_count} cruzamento(s) frágil(is) · alavanca {d.leverage_score.toFixed(1)}
                      </p>
                    </div>
                    {i < interventionOrder.length - 1 && (
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}