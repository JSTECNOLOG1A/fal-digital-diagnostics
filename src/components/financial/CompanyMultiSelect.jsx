/**
 * CompanyMultiSelect — Lista de empresas com seleção múltipla (checkboxes).
 * Reutilizado pelo formulário de definição e pelo wizard de criação.
 */
import React from 'react';
import { Check } from 'lucide-react';

/**
 * @param {Object} props
 * @param {any=} props.companies
 * @param {any=} props.selected
 * @param {any=} props.onToggle
 * @param {any=} props.excludeIds
 * @param {boolean=} props.disabled
 */
export default function CompanyMultiSelect({ companies = [], selected = [], onToggle, excludeIds = [], disabled = false }) {
  const list = companies.filter((c) => !excludeIds.includes(c.id));
  return (
    <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100 bg-white">
      {list.map((c) => {
        const on = selected.includes(c.id);
        return (
          <button key={c.id} type="button" disabled={disabled} onClick={disabled ? undefined : () => onToggle(c.id)}
            className={`flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${on ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
              {on && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className="text-sm text-slate-700 truncate">{c.trade_name || c.name}</span>
          </button>
        );
      })}
      {list.length === 0 && <p className="px-3 py-4 text-xs text-slate-400">Nenhuma empresa disponível.</p>}
    </div>
  );
}