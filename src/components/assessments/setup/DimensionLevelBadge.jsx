import React from 'react';
import { Building2, Factory, Users } from 'lucide-react';

const LEVEL_CONFIG = {
  group:   { label: 'Grupo',         cls: 'bg-purple-100 text-purple-700', icon: 'group'   },
  company: { label: 'Empresa',       cls: 'bg-blue-100 text-blue-700',     icon: 'company' },
  unit:    { label: 'Unid./Fazenda', cls: 'bg-emerald-100 text-emerald-700', icon: 'unit'  },
};

/**
 * @param {Object} props
 * @param {any=} props.level
 */
export default function DimensionLevelBadge({ level }) {
  const cfg = LEVEL_CONFIG[level] || { label: level, cls: 'bg-slate-100 text-slate-500', icon: 'company' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.cls}`}>
      {cfg.icon === 'group'   && <Users className="w-3 h-3" />}
      {cfg.icon === 'company' && <Building2 className="w-3 h-3" />}
      {cfg.icon === 'unit'    && <Factory className="w-3 h-3" />}
      {cfg.label}
    </span>
  );
}