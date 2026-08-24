import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

/**
 * @param {Object} props
 * @param {any=} props.rankings
 */
export default function PortfolioEvolutionPanel({ rankings = [] }) {
  const withEvolution = rankings.filter(r => r.total_evolution != null);
  if (!withEvolution.length) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-10 text-center text-slate-400 text-sm">
          Nenhum cliente com dados de evolução disponíveis ainda.
        </CardContent>
      </Card>
    );
  }

  const improving = [...withEvolution]
    .filter(r => r.total_evolution > 0)
    .sort((a, b) => b.total_evolution - a.total_evolution)
    .slice(0, 8);

  const regressing = [...withEvolution]
    .filter(r => r.total_evolution < 0)
    .sort((a, b) => a.total_evolution - b.total_evolution)
    .slice(0, 8);

  /**
   * @param {Object} props
   * @param {any=} props.r
   * @param {any=} props.positive
   */
  const Row = ({ r, positive }) => (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-700 truncate mr-2">{r.client_name || r.client_id}</span>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className={`text-sm font-bold tabular-nums ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
          {r.total_evolution >= 0 ? '+' : ''}{r.total_evolution.toFixed(2)}
        </span>
        {positive
          ? <TrendingUp className="w-4 h-4 text-emerald-500" />
          : <TrendingDown className="w-4 h-4 text-red-400" />
        }
      </div>
    </div>
  );

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Maior Evolução
          </CardTitle>
        </CardHeader>
        <CardContent>
          {improving.length === 0
            ? <p className="text-xs text-slate-400">Nenhum cliente em evolução.</p>
            : improving.map(r => <Row key={r.client_id} r={r} positive />)
          }
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
            Regressão de Maturidade
          </CardTitle>
        </CardHeader>
        <CardContent>
          {regressing.length === 0
            ? <p className="text-xs text-slate-400 py-2">Nenhum cliente com regressão identificada.</p>
            : regressing.map(r => <Row key={r.client_id} r={r} positive={false} />)
          }
        </CardContent>
      </Card>
    </div>
  );
}