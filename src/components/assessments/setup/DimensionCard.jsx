import React from 'react';
import { Settings, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ScopeStatusBadge from './ScopeStatusBadge.jsx';
import DimensionLevelBadge from './DimensionLevelBadge.jsx';
import SamplingModeBadge from './SamplingModeBadge.jsx';
import { getDimensionScopePolicy } from '@/lib/falAssessmentScopeUtils.js';

function computeStatus(dimKey, dimConfig) {
  if (!dimConfig?.active) return 'disabled';
  const policy = getDimensionScopePolicy(dimKey);
  const targets = dimConfig?.targets || [];
  if (targets.length === 0) return 'attention';
  const level = dimConfig?.level;
  if (level && !policy.allowed_levels.includes(level)) return 'incompatible';
  const hasSample = targets.some(t => t.sampling_mode === 'sample');
  if (hasSample) return 'sample';
  return 'configured';
}

/**
 * @param {Object} props
 * @param {any=} props.dimensionKey
 * @param {any=} props.config
 * @param {any=} props.onToggle
 * @param {any=} props.onConfigure
 */
export default function DimensionCard({ dimensionKey, config, onToggle, onConfigure }) {
  const policy = getDimensionScopePolicy(dimensionKey);
  const isActive = config?.active !== false;
  const targets = config?.targets || [];
  const status = computeStatus(dimensionKey, config);

  return (
    <div className={`rounded-2xl border-2 transition-all ${
      isActive
        ? status === 'incompatible' ? 'border-red-200 bg-red-50' :
          status === 'attention' ? 'border-amber-200 bg-amber-50' :
          'border-slate-200 bg-white shadow-sm'
        : 'border-slate-100 bg-slate-50 opacity-60'
    }`}>
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          {/* Toggle */}
          <button
            onClick={() => onToggle(dimensionKey)}
            className={`mt-0.5 w-10 h-6 rounded-full transition-all flex-shrink-0 relative ${isActive ? 'bg-blue-600' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${isActive ? 'left-5' : 'left-1'}`} />
          </button>

          {/* Icon + name */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg">{policy.icon}</span>
              <p className="font-semibold text-sm text-slate-900">{policy.label}</p>
              <ScopeStatusBadge status={status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{policy.description}</p>
          </div>
        </div>

        {/* Meta info */}
        {isActive && (
          <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
            <span className="text-slate-400">Sugerido:</span>
            <DimensionLevelBadge level={policy.default_level} />

            {config?.level && (
              <>
                <span className="text-slate-300">→</span>
                <span className="text-slate-400">Configurado:</span>
                <DimensionLevelBadge level={config.level} />
              </>
            )}

            {targets.length > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-medium text-slate-600">{targets.length} {targets.length === 1 ? 'entidade' : 'entidades'}</span>
              </>
            )}

            {targets.some(t => t.sampling_mode === 'sample') && (
              <SamplingModeBadge mode="sample" />
            )}
          </div>
        )}

        {/* Entities preview */}
        {isActive && targets.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {targets.slice(0, 3).map(t => (
              <span key={t.entity_id} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {t.entity_name}
              </span>
            ))}
            {targets.length > 3 && (
              <span className="text-[11px] text-slate-400 px-1">+{targets.length - 3}</span>
            )}
          </div>
        )}

        {/* Alert */}
        {isActive && status === 'attention' && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Nenhuma entidade selecionada. Configure antes de continuar.
          </div>
        )}
        {isActive && status === 'incompatible' && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-red-700">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Nível incompatível com a política FAL.
          </div>
        )}
      </div>

      {/* Configure button */}
      {isActive && (
        <div className="px-4 pb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onConfigure(dimensionKey)}
            className="w-full gap-1.5 border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            <Settings className="w-3.5 h-3.5" /> Configurar
          </Button>
        </div>
      )}
    </div>
  );
}