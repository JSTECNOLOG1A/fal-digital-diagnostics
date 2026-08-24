/**
 * MfisCrossingDrawer
 * Drawer lateral com detalhe completo de um cruzamento MFIS
 */
import React from 'react';
import { X, Shield, AlertTriangle, TrendingUp } from 'lucide-react';
import { TENSION_LABEL, TENSION_COLOR } from '@/lib/mfisDefinitions';

/**
 * @param {Object} props
 * @param {any=} props.label
 * @param {any=} props.value
 * @param {any=} props.max
 * @param {any=} props.color
 */
function ScoreBar({ label, value, max = 3, color = 'bg-blue-500' }) {
  const pct = Math.round((Math.min(value || 0, max) / max) * 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-600">{label}</span>
        <span className="text-xs font-bold text-slate-700">{value?.toFixed(2) ?? '—'} / {max}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.label
 * @param {any=} props.children
 */
function Field({ label, children }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      {children}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.crossing
 * @param {any=} props.onClose
 */
export default function MfisCrossingDrawer({ crossing, onClose }) {
  if (!crossing) return null;

  const colors = TENSION_COLOR[crossing.tension_level] || TENSION_COLOR.alerta;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className={`p-5 border-b ${colors.bg}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-3">
              <h2 className={`text-base font-bold ${colors.text} leading-snug`}>{crossing.crossing_label}</h2>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${colors.badge}`}>
                  {TENSION_LABEL[crossing.tension_level]}
                </span>
                <span className={`text-xs font-bold ${colors.text}`}>{crossing.cross_score_final?.toFixed(1)}/100</span>
                {!crossing.has_mqe_data && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Sem MQE</span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* Aviso sem MQE */}
          {!crossing.has_mqe_data && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
              <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Este cruzamento foi estimado com base nos scores estruturais das dimensões. As perguntas MQE específicas deste par ainda não foram respondidas.</span>
            </div>
          )}

          {/* Scores componentes */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Composição do Score</h3>
            <ScoreBar
              label={`${crossing.dimension_a_label} (Dimensão A)`}
              value={crossing.dimension_a_score_raw}
              max={3}
              color="bg-blue-500"
            />
            <ScoreBar
              label={`${crossing.dimension_b_label} (Dimensão B)`}
              value={crossing.dimension_b_score_raw}
              max={3}
              color="bg-indigo-500"
            />
            {crossing.has_mqe_data && (
              <ScoreBar
                label="Score MQE (cruzamento específico)"
                value={crossing.mqe_score_raw}
                max={3}
                color="bg-violet-500"
              />
            )}

            {/* Score final */}
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-700">Score Final (normalizado)</span>
                <span className={`text-lg font-bold ${colors.text}`}>{crossing.cross_score_final?.toFixed(1)}</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all ${
                    crossing.cross_score_final >= 80 ? 'bg-emerald-500' :
                    crossing.cross_score_final >= 60 ? 'bg-blue-500' :
                    crossing.cross_score_final >= 40 ? 'bg-amber-500' :
                    crossing.cross_score_final >= 20 ? 'bg-orange-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${crossing.cross_score_final}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                <span>0 — Ruptura</span>
                <span>100 — Integração madura</span>
              </div>
            </div>

            {/* Peso aplicado */}
            <p className="text-[10px] text-slate-400">
              Peso metodológico aplicado: ×{crossing.cross_weight} (tipo: {crossing.crossing_type})
            </p>
          </div>

          {/* Interpretação */}
          {crossing.interpretation_text && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Interpretação</h3>
              <Field label="Análise">
                <p className="text-sm text-slate-700 leading-relaxed">{crossing.interpretation_text}</p>
              </Field>
              {crossing.risk_summary && (
                <Field label="Risco associado">
                  <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-100 rounded-lg">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-700">{crossing.risk_summary}</p>
                  </div>
                </Field>
              )}
              {crossing.recommended_focus && (
                <Field label="Foco recomendado">
                  <div className="flex items-start gap-2 p-2 bg-blue-50 border border-blue-100 rounded-lg">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-700">{crossing.recommended_focus}</p>
                  </div>
                </Field>
              )}
            </div>
          )}

          {/* Metadado sistêmico */}
          <div className="pt-2 border-t space-y-2">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Metadado Sistêmico</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 rounded-lg p-2">
                <p className="text-slate-400 text-[10px]">Peso sistêmico</p>
                <p className="font-bold text-slate-700 text-base mt-0.5">{crossing.systemic_weight?.toFixed(2) ?? '—'}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2">
                <p className="text-slate-400 text-[10px]">Ranking de tensão</p>
                <p className="font-bold text-slate-700 text-base mt-0.5">#{crossing.tension_rank ?? '—'}</p>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 italic">O peso sistêmico é um metadado analítico que alimentará o refinamento do plano de ação em fases futuras.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-white">
          <button onClick={onClose} className="w-full text-sm text-slate-500 hover:text-slate-700 text-center">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}