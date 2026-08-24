import React from 'react';
import { AlertTriangle } from 'lucide-react';

const LEVEL_COLOR = {
  Crítico:     'border-red-300 bg-red-50 text-red-700',
  Básico:      'border-amber-300 bg-amber-50 text-amber-700',
  Estruturado: 'border-blue-300 bg-blue-50 text-blue-700',
  Avançado:    'border-emerald-300 bg-emerald-50 text-emerald-700',
};

/**
 * @param {Object} props
 * @param {any=} props.gapsTop
 */
export default function FalGapsPanel({ gapsTop }) {
  if (!gapsTop?.length) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <p className="text-sm font-semibold text-slate-700">Top 3 Dimensões com Maior Gap</p>
      </div>
      {gapsTop.map((g, i) => (
        <div key={g.dimension} className={`border rounded-lg p-3 ${LEVEL_COLOR[g.level] || 'border-slate-200 bg-slate-50'}`}>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold mr-2">#{i + 1}</span>
              <span className="text-sm font-medium">{g.axis}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono">{(g.score || 0).toFixed(2)} / 3.0</span>
              <span className="text-xs font-semibold">{g.level}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}