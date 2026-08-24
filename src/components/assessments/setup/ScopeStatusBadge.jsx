import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, FlaskConical, Ban } from 'lucide-react';

const STATUS_CONFIG = {
  configured:   { label: 'Configurada',    cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: 'check' },
  attention:    { label: 'Requer atenção', cls: 'bg-amber-100 text-amber-700 border-amber-200',       icon: 'warn' },
  disabled:     { label: 'Desativada',     cls: 'bg-slate-100 text-slate-400 border-slate-200',       icon: 'x' },
  sample:       { label: 'Amostral',       cls: 'bg-blue-100 text-blue-700 border-blue-200',          icon: 'flask' },
  incompatible: { label: 'Incompatível',   cls: 'bg-red-100 text-red-700 border-red-200',             icon: 'ban' },
};

/**
 * @param {Object} props
 * @param {any=} props.status
 */
export default function ScopeStatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.attention;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${cfg.cls}`}>
      {cfg.icon === 'check' && <CheckCircle2 className="w-3 h-3" />}
      {cfg.icon === 'warn'  && <AlertTriangle className="w-3 h-3" />}
      {cfg.icon === 'x'     && <XCircle className="w-3 h-3" />}
      {cfg.icon === 'flask' && <FlaskConical className="w-3 h-3" />}
      {cfg.icon === 'ban'   && <Ban className="w-3 h-3" />}
      {cfg.label}
    </span>
  );
}