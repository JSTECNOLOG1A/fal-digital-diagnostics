/**
 * MfisTensionRanking — Bloco 3
 * Top tensões sistêmicas ordenadas por criticidade
 */
import React from 'react';
import { TENSION_LABEL, TENSION_COLOR } from '@/lib/mfisDefinitions';

/**
 * @param {Object} props
 * @param {any=} props.crossings
 */
export default function MfisTensionRanking({ crossings = [] }) {
  const top5 = [...crossings]
    .sort((a, b) => a.cross_score_final - b.cross_score_final)
    .slice(0, 5);

  if (!top5.length) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
        Top Tensões Sistêmicas
      </h3>
      {top5.map((c, i) => {
        const colors = TENSION_COLOR[c.tension_level];
        return (
          <div key={c.crossing_key} className={`flex items-start gap-3 p-3 rounded-xl border ${colors.bg} ${colors.border}`}>
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/70 flex items-center justify-center">
              <span className="text-xs font-bold text-slate-600">{i + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm font-semibold ${colors.text}`}>{c.crossing_label}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${colors.badge}`}>
                  {c.cross_score_final.toFixed(0)}/100
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{TENSION_LABEL[c.tension_level]}</p>
              {c.risk_summary && (
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{c.risk_summary}</p>
              )}
              {!c.has_mqe_data && (
                <p className="text-[10px] text-slate-400 mt-1 italic">Estimativa baseada em scores estruturais (sem MQE)</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}