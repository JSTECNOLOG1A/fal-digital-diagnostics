import React from 'react';
import { Check, Minus } from 'lucide-react';
import { getDimensionScopePolicy } from '@/lib/falAssessmentScopeUtils.js';
import { DIMENSION_KEYS_ORDERED } from '@/lib/falDimensionScopePolicy.js';
import SamplingModeBadge from './SamplingModeBadge.jsx';

const LEVEL_ICONS = { group: '🏢', company: '🏭', unit: '🌾' };

/**
 * @param {Object} props
 * @param {any=} props.dimensions
 */
export default function CoverageMap({ dimensions }) {
  const activeDims = DIMENSION_KEYS_ORDERED.filter(k => dimensions[k]?.active !== false && dimensions[k]?.targets?.length > 0);

  if (activeDims.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p className="text-sm">Nenhuma dimensão configurada ainda.</p>
        <p className="text-xs mt-1">Configure as dimensões na etapa anterior para ver o mapa de cobertura.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider rounded-tl-xl">Dimensão</th>
            <th className="text-center px-3 py-3 text-xs font-bold uppercase tracking-wider">Grupo</th>
            <th className="text-center px-3 py-3 text-xs font-bold uppercase tracking-wider">Empresa</th>
            <th className="text-center px-3 py-3 text-xs font-bold uppercase tracking-wider">Unidade</th>
            <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider">Entidades</th>
            <th className="text-center px-3 py-3 text-xs font-bold uppercase tracking-wider">Cobertura</th>
            <th className="text-center px-3 py-3 text-xs font-bold uppercase tracking-wider rounded-tr-xl">IFME™</th>
          </tr>
        </thead>
        <tbody>
          {activeDims.map((dimKey, idx) => {
            const policy = getDimensionScopePolicy(dimKey);
            const config = dimensions[dimKey] || {};
            const targets = config.targets || [];
            const level = config.level || policy.default_level;
            const hasSample = targets.some(t => t.sampling_mode === 'sample');
            const allInIfme = targets.filter(t => t.include_in_consolidated_score !== false);
            const isLast = idx === activeDims.length - 1;

            return (
              <tr key={dimKey} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${isLast ? '' : ''}`}>
                <td className={`px-4 py-3 ${isLast ? 'rounded-bl-xl' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span>{policy.icon}</span>
                    <span className="font-medium text-slate-800">{policy.label}</span>
                  </div>
                </td>
                <td className="text-center px-3 py-3">
                  {level === 'group' ? <span className="text-lg">✓</span> : <span className="text-slate-200">—</span>}
                </td>
                <td className="text-center px-3 py-3">
                  {level === 'company' ? <span className="text-lg">✓</span> : <span className="text-slate-200">—</span>}
                </td>
                <td className="text-center px-3 py-3">
                  {level === 'unit' ? <span className="text-lg">✓</span> : <span className="text-slate-200">—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {targets.slice(0, 4).map(t => (
                      <span key={t.entity_id} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {LEVEL_ICONS[t.level] || ''} {t.entity_name}
                      </span>
                    ))}
                    {targets.length > 4 && (
                      <span className="text-[11px] text-slate-400">+{targets.length - 4}</span>
                    )}
                  </div>
                </td>
                <td className="text-center px-3 py-3">
                  <SamplingModeBadge mode={hasSample ? 'sample' : 'full'} />
                </td>
                <td className={`text-center px-3 py-3 ${isLast ? 'rounded-br-xl' : ''}`}>
                  {allInIfme.length > 0
                    ? <span className="inline-flex items-center justify-center w-5 h-5 bg-emerald-100 rounded-full"><Check className="w-3 h-3 text-emerald-600" /></span>
                    : <span className="inline-flex items-center justify-center w-5 h-5 bg-slate-100 rounded-full"><Minus className="w-3 h-3 text-slate-400" /></span>
                  }
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}