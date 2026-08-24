/**
 * MfisCrossingGrid — Bloco 2
 * Grid dos 11 cruzamentos com score, classificação e clique para detalhe
 */
import React from 'react';
import { TENSION_LABEL, TENSION_COLOR, MFIS_CROSSINGS } from '@/lib/mfisDefinitions';
import { Lock } from 'lucide-react';

const TYPE_LABEL = {
  strategic:     'Estratégico',
  institutional: 'Institucional',
  financial:     'Financeiro',
  operational:   'Operacional',
  integrity:     'Integridade',
};

const TYPE_GROUPS = [
  { type: 'strategic',     label: 'Núcleo Estratégico' },
  { type: 'institutional', label: 'Núcleo Institucional' },
  { type: 'financial',     label: 'Núcleo Financeiro' },
  { type: 'operational',   label: 'Núcleo Operacional' },
  { type: 'integrity',     label: 'Núcleo de Integridade' },
];

/**
 * @param {Object} props
 * @param {any=} props.score
 */
function ScoreArc({ score }) {
  const pct = Math.min(100, Math.max(0, score || 0));
  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#3b82f6' : pct >= 40 ? '#f59e0b' : pct >= 20 ? '#f97316' : '#ef4444';
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-14 h-14">
        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="22" fill="none" stroke="#e2e8f0" strokeWidth="5" />
          <circle
            cx="28" cy="28" r="22" fill="none"
            stroke={color} strokeWidth="5"
            strokeDasharray={`${(pct / 100) * 138.2} 138.2`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-slate-700">{Math.round(pct)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.crossing
 * @param {any=} props.computed
 * @param {any=} props.onOpen
 */
function CrossingCard({ crossing, computed, onOpen }) {
  const colors = computed ? TENSION_COLOR[computed.tension_level] : null;
  const isInactive = !computed;

  return (
    <button
      onClick={() => !isInactive && onOpen(computed)}
      disabled={isInactive}
      className={`w-full text-left rounded-xl border p-3 transition-all ${
        isInactive
          ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
          : `${colors.bg} ${colors.border} hover:shadow-md cursor-pointer`
      }`}
    >
      <p className="text-xs font-semibold text-slate-700 leading-snug mb-2">{crossing.label}</p>
      {isInactive ? (
        <div className="flex items-center gap-1 text-[10px] text-slate-400">
          <Lock className="w-3 h-3" /> Dimensões inativas neste assessment
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <ScoreArc score={computed.cross_score_final} />
          <div className="text-right flex-1 ml-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${colors.badge}`}>
              {TENSION_LABEL[computed.tension_level]}
            </span>
            {!computed.has_mqe_data && (
              <p className="text-[9px] text-slate-400 mt-1">Sem dados MQE</p>
            )}
          </div>
        </div>
      )}
    </button>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.crossings
 * @param {any=} props.onOpenCrossing
 */
export default function MfisCrossingGrid({ crossings = [], onOpenCrossing }) {
  // Map computed crossings by key
  const byKey = new Map(crossings.map(c => [c.crossing_key, c]));

  return (
    <div className="space-y-4">
      {TYPE_GROUPS.map(group => {
        const groupCrossings = MFIS_CROSSINGS.filter(c => c.crossing_type === group.type);
        return (
          <div key={group.type}>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{group.label}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {groupCrossings.map(crossing => (
                <CrossingCard
                  key={crossing.key}
                  crossing={crossing}
                  computed={byKey.get(crossing.key) || null}
                  onOpen={onOpenCrossing}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}