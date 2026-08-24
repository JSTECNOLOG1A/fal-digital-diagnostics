import React from 'react';
import { FlaskConical, Check, Minus } from 'lucide-react';

const SAMPLING_CONFIG = {
  full:           { label: 'Completa',  cls: 'bg-emerald-100 text-emerald-700', icon: 'check' },
  sample:         { label: 'Amostral',  cls: 'bg-amber-100 text-amber-700',     icon: 'flask' },
  not_applicable: { label: 'N/A',       cls: 'bg-slate-100 text-slate-400',     icon: 'minus' },
};

/**
 * @param {Object} props
 * @param {any=} props.mode
 */
export default function SamplingModeBadge({ mode }) {
  const cfg = SAMPLING_CONFIG[mode] || SAMPLING_CONFIG.full;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.cls}`}>
      {cfg.icon === 'check' && <Check className="w-3 h-3" />}
      {cfg.icon === 'flask' && <FlaskConical className="w-3 h-3" />}
      {cfg.icon === 'minus' && <Minus className="w-3 h-3" />}
      {cfg.label}
    </span>
  );
}