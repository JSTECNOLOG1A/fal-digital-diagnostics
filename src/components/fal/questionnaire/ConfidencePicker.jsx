import React from 'react';
import { MessageSquare, CheckSquare, ShieldCheck } from 'lucide-react';

const LEVELS = [
  { value: 'auto_declarada', label: 'Auto-declarada', short: 'Auto',    icon: MessageSquare, color: 'text-slate-500 bg-slate-100 border-slate-200' },
  { value: 'confirmada',     label: 'Confirmada',     short: 'Conf.',   icon: CheckSquare,   color: 'text-blue-600 bg-blue-50 border-blue-200'    },
  { value: 'auditada',       label: 'Auditada',       short: 'Audit.',  icon: ShieldCheck,   color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
];

/**
 * @param {Object} props
 * @param {any=} props.value
 * @param {any=} props.onChange
 */
export default function ConfidencePicker({ value, onChange }) {
  const current = value || 'auto_declarada';

  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-slate-400 mr-1">Confiança:</span>
      {LEVELS.map(l => (
        <button
          key={l.value}
          onClick={() => onChange(l.value === current ? 'auto_declarada' : l.value)}
          title={l.label}
          className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-all
            ${current === l.value ? l.color + ' font-semibold' : 'text-slate-400 bg-white border-slate-200 hover:border-slate-300'}`}
        >
          <l.icon className="w-2.5 h-2.5" />
          <span className="hidden sm:inline">{l.short}</span>
        </button>
      ))}
    </div>
  );
}