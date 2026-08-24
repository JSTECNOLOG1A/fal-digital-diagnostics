import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

/**
 * @param {Object} props
 * @param {any=} props.dimensionScores
 */
export default function FalClusterHierarchy({ dimensionScores = {} }) {
  const [expandedDims, setExpandedDims] = useState(new Set());
  const [expandedSubs, setExpandedSubs] = useState(new Set());

  const toggleDimension = (dim) => {
    const next = new Set(expandedDims);
    if (next.has(dim)) next.delete(dim);
    else next.add(dim);
    setExpandedDims(next);
  };

  const toggleSubdim = (key) => {
    const next = new Set(expandedSubs);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedSubs(next);
  };

  const getLevelColor = (level) => {
    if (!level || level === 'N/A') return 'text-gray-400';
    if (level === 'Crítico') return 'text-red-600';
    if (level === 'Básico') return 'text-yellow-600';
    if (level === 'Estruturado') return 'text-blue-600';
    return 'text-green-600';
  };

  return (
    <div className="space-y-2 text-sm">
      {Object.entries(dimensionScores).map(([dimKey, dimData]) => {
        const isExpanded = expandedDims.has(dimKey);

        return (
          <div key={dimKey} className="border-l-2 border-slate-200">
            <button
              onClick={() => toggleDimension(dimKey)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-left"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <span className="font-semibold">{dimKey}</span>
              <span className={`ml-auto ${getLevelColor(dimData.level)}`}>
                {dimData.score !== null ? dimData.score.toFixed(1) : 'N/A'}
              </span>
            </button>

            {isExpanded && (
              <div className="pl-4 space-y-1">
                {Object.entries(dimData.subdimension_scores || {}).map(([subKey, subData]) => {
                  const subExpanded = expandedSubs.has(`${dimKey}:${subKey}`);

                  return (
                    <div key={subKey}>
                      <button
                        onClick={() => toggleSubdim(`${dimKey}:${subKey}`)}
                        className="w-full flex items-center gap-2 px-3 py-1 hover:bg-slate-50 text-left text-xs"
                      >
                        {subExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        <span className="font-medium text-slate-700">{subKey}</span>
                        <span className={`ml-auto ${getLevelColor(subData.level)}`}>
                          {subData.score.toFixed(1)}
                        </span>
                      </button>

                      {subExpanded && (
                        <div className="pl-6 space-y-0.5">
                          {Object.entries(subData.cluster_scores || {}).map(([clusterKey, clusterScore]) => (
                            <div
                              key={clusterKey}
                              className="flex items-center justify-between px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
                            >
                              <span className="flex-1">{clusterKey}</span>
                              <span className="font-medium">{clusterScore.toFixed(1)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}