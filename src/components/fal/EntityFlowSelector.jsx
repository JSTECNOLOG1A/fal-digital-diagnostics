import React from 'react';
import { Building2, Layers, MapPin } from 'lucide-react';

const LEVEL_CONFIG = {
  group:   { label: 'Grupo',    Icon: Layers,    bg: 'bg-indigo-50',  border: 'border-indigo-300', text: 'text-indigo-700',  activeBg: 'bg-indigo-600',  activeBorder: 'border-indigo-600',  activeText: 'text-white' },
  company: { label: 'Empresa',  Icon: Building2, bg: 'bg-blue-50',    border: 'border-blue-300',   text: 'text-blue-700',    activeBg: 'bg-blue-600',    activeBorder: 'border-blue-600',    activeText: 'text-white' },
  unit:    { label: 'Unidade',  Icon: MapPin,    bg: 'bg-emerald-50', border: 'border-emerald-300',text: 'text-emerald-700', activeBg: 'bg-emerald-600', activeBorder: 'border-emerald-600', activeText: 'text-white' },
};

/**
 * @param {Object} props
 * @param {any=} props.linkedEntities
 * @param {any=} props.selectedEntityId
 * @param {any=} props.onSelect
 */
export default function EntityFlowSelector({ linkedEntities = [], selectedEntityId, onSelect }) {
  if (!linkedEntities.length) return null;

  return (
    <div className="mb-4">
      {/* Label */}
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
        Selecionar contexto de resposta
      </p>

      {/* Entities in a single horizontal flow — no wrapper card, colado */}
      <div className="flex flex-wrap items-center gap-0">
        {linkedEntities.map((entity, index) => {
          const cfg = LEVEL_CONFIG[entity.entity_type] || LEVEL_CONFIG.company;
          const { Icon } = cfg;
          const isSelected = entity.entity_id === selectedEntityId;

          return (
            <React.Fragment key={entity.entity_id}>
              <button
                type="button"
                onClick={() => onSelect(entity)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-semibold
                  transition-all duration-150 shadow-sm
                  ${isSelected
                    ? `${cfg.activeBg} ${cfg.activeBorder} ${cfg.activeText} shadow-md`
                    : `${cfg.bg} ${cfg.border} ${cfg.text} hover:brightness-95`
                  }
                `}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                {entity.entity_name}
              </button>

              {/* Connector arrow between entities */}
              {index < linkedEntities.length - 1 && (
                <span className="flex items-center px-1 text-slate-300">
                  <svg width="20" height="16" viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <line x1="0" y1="8" x2="14" y2="8" stroke="#CBD5E1" strokeWidth="1.5" />
                    <polygon points="14,4 20,8 14,12" fill="#CBD5E1" />
                  </svg>
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}