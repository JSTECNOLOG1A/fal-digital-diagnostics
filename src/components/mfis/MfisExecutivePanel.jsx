/**
 * MfisExecutivePanel — Bloco 1
 * Síntese executiva: maior tensão, alavanca, mais forte, totais
 */
import React from 'react';
import { AlertTriangle, TrendingUp, Shield, Zap } from 'lucide-react';
import { TENSION_LABEL, TENSION_COLOR } from '@/lib/mfisDefinitions';

/**
 * @param {Object} props
 * @param {any=} props.crossings
 * @param {any=} props.dimImpacts
 * @param {any=} props.hasMqeData
 */
export default function MfisExecutivePanel({ crossings = [], dimImpacts = [], hasMqeData = false }) {
  if (!crossings.length) return null;

  const sorted     = [...crossings].sort((a, b) => a.cross_score_final - b.cross_score_final);
  const worstCross = sorted[0];
  const bestCross  = [...crossings].sort((a, b) => b.cross_score_final - a.cross_score_final)[0];
  const leverage   = dimImpacts.find(d => d.is_systemic_leverage_point);
  const fragile    = crossings.filter(c => c.is_fragile).length;
  const critical   = crossings.filter(c => c.is_critical).length;

  const worstColor = worstCross ? TENSION_COLOR[worstCross.tension_level] : TENSION_COLOR.alerta;
  const bestColor  = bestCross  ? TENSION_COLOR[bestCross.tension_level]  : TENSION_COLOR.madura;

  return (
    <div className="space-y-3">
      {/* Aviso MQE ausente */}
      {!hasMqeData && (
        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
          <Shield className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
          <div>
            <p className="font-semibold">Leitura sistêmica preliminar</p>
            <p className="mt-0.5 text-amber-700">Esta análise está baseada nos scores estruturais das dimensões. Os cruzamentos MQE ainda não foram respondidos, então a interdependência foi estimada sem validação específica dos pares.</p>
          </div>
        </div>
      )}

      {/* Cards executivos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Maior tensão */}
        <div className={`p-4 rounded-xl border ${worstColor.bg} ${worstColor.border}`}>
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className={`w-4 h-4 ${worstColor.text}`} />
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Maior Tensão</p>
          </div>
          <p className={`text-sm font-bold leading-snug ${worstColor.text}`}>{worstCross?.crossing_label || '—'}</p>
          <p className="text-xs text-slate-500 mt-1">{TENSION_LABEL[worstCross?.tension_level]} · {worstCross?.cross_score_final?.toFixed(0)}/100</p>
        </div>

        {/* Ponto de alavanca */}
        <div className="p-4 rounded-xl border bg-indigo-50 border-indigo-200">
          <div className="flex items-center gap-1.5 mb-2">
            <Zap className="w-4 h-4 text-indigo-500" />
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Ponto de Alavanca</p>
          </div>
          <p className="text-sm font-bold text-indigo-700 leading-snug">{leverage?.dimension_label || '—'}</p>
          <p className="text-xs text-slate-500 mt-1">
            {leverage ? `${leverage.fragile_crossings_count} cruzamento(s) frágil(is)` : 'Calculando...'}
          </p>
        </div>

        {/* Cruzamento mais forte */}
        <div className={`p-4 rounded-xl border ${bestColor.bg} ${bestColor.border}`}>
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className={`w-4 h-4 ${bestColor.text}`} />
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Mais Integrado</p>
          </div>
          <p className={`text-sm font-bold leading-snug ${bestColor.text}`}>{bestCross?.crossing_label || '—'}</p>
          <p className="text-xs text-slate-500 mt-1">{TENSION_LABEL[bestCross?.tension_level]} · {bestCross?.cross_score_final?.toFixed(0)}/100</p>
        </div>

        {/* Totais */}
        <div className="p-4 rounded-xl border bg-slate-50 border-slate-200">
          <div className="flex items-center gap-1.5 mb-2">
            <Shield className="w-4 h-4 text-slate-400" />
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Situação</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Cruzamentos</span>
              <span className="text-xs font-bold text-slate-700">{crossings.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Frágeis</span>
              <span className={`text-xs font-bold ${fragile > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{fragile}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Críticos</span>
              <span className={`text-xs font-bold ${critical > 0 ? 'text-red-600' : 'text-slate-400'}`}>{critical}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}