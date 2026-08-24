import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const levelColor = {
  'Crítico': 'bg-red-100 text-red-700',
  'Alto':    'bg-orange-100 text-orange-700',
};

const scoreBar = (score) => {
  const pct = Math.min(100, (score / 3) * 100);
  const color = score < 1.0 ? 'bg-red-500' : score < 1.5 ? 'bg-orange-400' : 'bg-amber-400';
  return (
    <div className="w-16 bg-slate-100 rounded-full h-1.5">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

/**
 * @param {Object} props
 * @param {any=} props.clusters
 */
export default function CriticalClustersPanel({ clusters = [] }) {
  return (
    <Card className="border-0 shadow-sm">
      <div className="p-4 border-b border-slate-100 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-red-500" />
        <h2 className="text-sm font-semibold text-slate-700">Top Clusters Críticos da Carteira</h2>
      </div>
      <CardContent className="p-0">
        {clusters.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <p className="text-sm">Nenhum cluster crítico identificado</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {clusters.slice(0, 10).map((c, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-bold text-slate-300 w-4">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{c.cluster_key}</p>
                    <p className="text-[10px] text-slate-400 truncate">{c.dimension_key}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {scoreBar(c.score)}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${levelColor[c.level] || 'bg-slate-100 text-slate-600'}`}>
                    {c.score?.toFixed(2)}
                  </span>
                  {c.assessment_id && (
                    <Link to={createPageUrl(`AssessmentDetail?id=${c.assessment_id}`)} className="text-[10px] text-blue-500 hover:underline">ver →</Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}