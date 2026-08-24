import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy } from 'lucide-react';

const levelColors = {
  'Crítico':     'bg-red-100 text-red-700',
  'Básico':      'bg-amber-100 text-amber-700',
  'Estruturado': 'bg-blue-100 text-blue-700',
  'Avançado':    'bg-emerald-100 text-emerald-700',
};

const rankIcon = (rank) => {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
};

/**
 * @param {Object} props
 * @param {any=} props.rankings
 */
export default function PortfolioRankingPanel({ rankings = [] }) {
  return (
    <Card className="border-0 shadow-sm">
      <div className="p-4 border-b border-slate-100 flex items-center gap-2">
        <Trophy className="w-4 h-4 text-amber-500" />
        <h2 className="text-sm font-semibold text-slate-700">Ranking da Carteira</h2>
      </div>
      <CardContent className="p-0">
        {rankings.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">Nenhum dado disponível</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {rankings.slice(0, 10).map((client) => (
              <div key={client.client_id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm w-8 flex-shrink-0 text-center">{rankIcon(client.rank)}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{client.client_name}</p>
                    <p className="text-[10px] text-slate-400">{client.assessment_count} assessment(s)</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Maturidade */}
                  <div className="text-center hidden sm:block">
                    <p className="text-[10px] text-slate-400">Maturidade</p>
                    <p className="text-sm font-bold text-blue-700">
                      {client.avg_overall_score !== null ? `${Math.round((client.avg_overall_score / 3) * 100)}%` : '—'}
                    </p>
                  </div>
                  {/* Críticos */}
                  <div className="text-center hidden sm:block">
                    <p className="text-[10px] text-slate-400">Críticos</p>
                    <p className={`text-sm font-bold ${client.critical_clusters > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {client.critical_clusters ?? '—'}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${levelColors[client.overall_level] || 'bg-slate-100 text-slate-600'}`}>
                    {client.avg_overall_score?.toFixed(2) ?? '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}