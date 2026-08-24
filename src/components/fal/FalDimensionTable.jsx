import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight } from 'lucide-react';

const LEVEL_STYLE = {
  Crítico:     'bg-red-100 text-red-700',
  Básico:      'bg-amber-100 text-amber-700',
  Estruturado: 'bg-blue-100 text-blue-700',
  Avançado:    'bg-emerald-100 text-emerald-700',
};

const DIM_ORDER = ['governanca','juridico','controles_internos','financeiro','contabil','tributario','operacional','sistemas'];

const DIM_LABELS = {
  governanca:         'Governança',
  juridico:           'Jurídico / Societário',
  controles_internos: 'Controles Internos',
  financeiro:         'Financeiro',
  contabil:           'Contábil',
  tributario:         'Fiscal',
  operacional:        'Operacional / Cultura e Ambiente',
  sistemas:           'Tecnologia / Sistemas',
};

/**
 * @param {Object} props
 * @param {any=} props.score
 */
function ScoreBar({ score }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{ width: `${Math.min(100, ((score || 0) / 3) * 100)}%` }}
        />
      </div>
      <span className="font-mono text-xs text-slate-600 w-8">{(score || 0).toFixed(2)}</span>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.dimensionScores
 * @param {any=} props.activeDimensions
 */
export default function FalDimensionTable({ dimensionScores, activeDimensions }) {
  const [expanded, setExpanded] = useState(/** @type {Record<string, any>} */ ({}));

  if (!dimensionScores) return null;

  const rows = DIM_ORDER
    .filter(k => {
      if (activeDimensions?.length && !activeDimensions.includes(k)) return false;
      return dimensionScores[k] !== undefined;
    })
    .map(k => ({ dim: k, ...dimensionScores[k] }));

  const toggleExpand = (dim) => setExpanded(prev => ({ ...prev, [dim]: !prev[dim] }));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left">
            <th className="pb-2 text-slate-500 font-medium">Dimensão</th>
            <th className="pb-2 text-slate-500 font-medium text-center">Score</th>
            <th className="pb-2 text-slate-500 font-medium text-center">Nível</th>
            <th className="pb-2 text-slate-500 font-medium text-center">Resp.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const subdims = r.subdimension_scores
              ? Object.entries(r.subdimension_scores).filter(([k]) => k !== '_none')
              : [];
            const isExpanded = expanded[r.dim];

            return (
              <React.Fragment key={r.dim}>
                <tr
                  className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${subdims.length > 0 ? 'cursor-pointer' : ''}`}
                  onClick={() => subdims.length > 0 && toggleExpand(r.dim)}
                >
                  <td className="py-2.5 font-medium text-slate-700">
                    <div className="flex items-center gap-1.5">
                      {subdims.length > 0 && (
                        isExpanded
                          ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      {DIM_LABELS[r.dim] || r.dim}
                    </div>
                  </td>
                  <td className="py-2.5 text-center">
                    {r.active === false
                      ? <span className="text-xs text-slate-300">N/A</span>
                      : <ScoreBar score={r.score} />
                    }
                  </td>
                  <td className="py-2.5 text-center">
                    <Badge className={`text-xs ${r.active === false ? 'bg-slate-100 text-slate-400' : (LEVEL_STYLE[r.level] || 'bg-slate-100 text-slate-600')}`}>
                      {r.active === false ? 'N/A' : (r.level || '—')}
                    </Badge>
                  </td>
                  <td className="py-2.5 text-center text-xs text-slate-500">
                    {r.active === false ? '—' : (r.response_count || 0)}
                  </td>
                </tr>

                {isExpanded && subdims.map(([subKey, subVal]) => (
                  <tr key={`${r.dim}-${subKey}`} className="border-b border-slate-50 bg-slate-50/50">
                    <td className="py-2 pl-8 text-xs text-slate-500">{subKey}</td>
                    <td className="py-2 text-center">
                      <ScoreBar score={subVal.score} />
                    </td>
                    <td className="py-2 text-center">
                      <Badge className={`text-[10px] ${LEVEL_STYLE[subVal.level] || 'bg-slate-100 text-slate-500'}`}>
                        {subVal.level || '—'}
                      </Badge>
                    </td>
                    <td className="py-2 text-center text-xs text-slate-400">
                      {subVal.response_count}/{subVal.total_questions}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}