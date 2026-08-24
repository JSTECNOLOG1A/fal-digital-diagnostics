import React from 'react';

export const SCORE_CONFIGS = [
  { val: 0, label: 'Inexistente', textColor: 'text-red-600',     borderActive: 'border-red-400',     bgActive: 'bg-red-50'     },
  { val: 1, label: 'Inicial',     textColor: 'text-amber-500',   borderActive: 'border-amber-400',   bgActive: 'bg-amber-50'   },
  { val: 2, label: 'Estruturado', textColor: 'text-yellow-600',  borderActive: 'border-yellow-400',  bgActive: 'bg-yellow-50'  },
  { val: 3, label: 'Consolidado', textColor: 'text-emerald-600', borderActive: 'border-emerald-500', bgActive: 'bg-emerald-50' },
];

/**
 * ScoreSelector — Componente centralizado de seleção de notas 0–3.
 * Reduzido ~15% horizontalmente (px/py menores, texto compacto).
 */
export default function ScoreSelector({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {SCORE_CONFIGS.map(s => {
        const isSelected = value === s.val;
        return (
          <button
            key={s.val}
            onClick={() => onChange(s.val)}
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl border-2 text-left transition-all duration-200 focus:outline-none
              ${isSelected
                ? `${s.bgActive} ${s.borderActive} ring-2 ring-offset-1 ring-slate-200`
                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
          >
            <div>
              <span className={`block text-xl font-black ${s.textColor}`}>{s.val}</span>
              <span className="text-[11px] font-semibold text-slate-500 mt-0.5 block leading-tight">{s.label}</span>
            </div>
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
              ${isSelected ? 'border-green-700 bg-green-700' : 'border-slate-300 bg-white'}`}
              style={isSelected ? {borderColor:'var(--fal-green-700)', background:'var(--fal-green-700)'} : {}}>
              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}