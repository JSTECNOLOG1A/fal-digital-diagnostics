import React from 'react';
import { LayoutDashboard, SlidersHorizontal } from 'lucide-react';

/**
 * LayoutModeToggle
 * Alterna entre "Automático" (segue a periodicidade cadastrada no diagnóstico)
 * e "Layout DF" (personalizado — habilita o seletor manual de períodos).
 */
export default function LayoutModeToggle({ layoutMode, setLayoutMode, autoResolutionLabel }) {
  const options = [
    { key: 'auto', label: 'Automático', icon: LayoutDashboard, sub: autoResolutionLabel || 'Padrão' },
    { key: 'df',   label: 'Layout DF',  icon: SlidersHorizontal, sub: 'Personalizado' },
  ];

  return (
    <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
      {options.map(o => {
        const active = layoutMode === o.key;
        return (
          <button
            key={o.key}
            onClick={() => setLayoutMode(o.key)}
            title={o.key === 'auto' ? `Automático — ${o.sub}` : 'Layout personalizado (escolha manual)'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all
              ${active ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700 border border-transparent'}`}
          >
            <o.icon className="w-3.5 h-3.5" />
            {o.label}
            <span className={`text-[10px] font-normal ${active ? 'text-slate-400' : 'text-slate-400'}`}>
              · {o.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}