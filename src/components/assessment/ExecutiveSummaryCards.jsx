import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, AlertTriangle, CheckSquare, Zap, BarChart3 } from 'lucide-react';

function getEvolutionColor(val) {
  if (val == null) return 'text-slate-400';
  return val >= 0 ? 'text-emerald-600' : 'text-red-500';
}

function getCriticalColor(count) {
  if (count == null) return 'text-slate-400';
  if (count > 10) return 'text-red-600';
  if (count > 5) return 'text-orange-500';
  return 'text-emerald-600';
}

function getExecutionColor(rate) {
  if (rate == null) return 'text-slate-400';
  if (rate >= 70) return 'text-emerald-600';
  if (rate >= 40) return 'text-orange-500';
  return 'text-red-500';
}

/**
 * @param {Object} props
 * @param {any=} props.snapshot
 */
export default function ExecutiveSummaryCards({ snapshot }) {
  if (!snapshot) return null;

  const {
    maturity_index,
    total_evolution,
    critical_clusters_count,
    total_clusters_count,
    action_execution_rate,
    impact_potential,
  } = snapshot;

  const cards = [
    {
      title: 'Maturidade',
      value: maturity_index != null ? `${Math.round(maturity_index)}%` : '—',
      description: 'Nível atual de maturidade empresarial',
      icon: BarChart3,
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-600',
      valueColor: 'text-slate-900',
    },
    {
      title: 'Evolução',
      value: total_evolution != null
        ? `${total_evolution >= 0 ? '+' : ''}${total_evolution.toFixed(1)}`
        : '—',
      description: 'Evolução desde o diagnóstico inicial',
      icon: total_evolution >= 0 ? TrendingUp : TrendingDown,
      iconBg: total_evolution == null ? 'bg-slate-100' : total_evolution >= 0 ? 'bg-emerald-50' : 'bg-red-50',
      iconColor: total_evolution == null ? 'text-slate-400' : total_evolution >= 0 ? 'text-emerald-600' : 'text-red-500',
      valueColor: getEvolutionColor(total_evolution),
    },
    {
      title: 'Clusters Críticos',
      value: critical_clusters_count != null
        ? `${critical_clusters_count}${total_clusters_count != null ? ` de ${total_clusters_count}` : ''}`
        : '—',
      description: 'clusters com score crítico',
      icon: AlertTriangle,
      iconBg: critical_clusters_count > 10 ? 'bg-red-50' : critical_clusters_count > 5 ? 'bg-orange-50' : 'bg-emerald-50',
      iconColor: getCriticalColor(critical_clusters_count),
      valueColor: getCriticalColor(critical_clusters_count),
    },
    {
      title: 'Execução do Plano',
      value: action_execution_rate != null ? `${Math.round(action_execution_rate)}%` : '—',
      description: 'ações concluídas do plano de ação',
      icon: CheckSquare,
      iconBg: action_execution_rate >= 70 ? 'bg-emerald-50' : action_execution_rate >= 40 ? 'bg-orange-50' : 'bg-red-50',
      iconColor: getExecutionColor(action_execution_rate),
      valueColor: getExecutionColor(action_execution_rate),
    },
    {
      title: 'Impacto Potencial',
      value: impact_potential != null
        ? `+${impact_potential.toFixed(1)}`
        : '—',
      description: 'ganho estimado se ações forem implementadas',
      icon: Zap,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      valueColor: 'text-blue-600',
    },
  ];

  return (
    <div className="mb-6">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Resumo Executivo</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map(({ title, value, description, icon: Icon, iconBg, iconColor, valueColor }) => (
          <Card key={title} className="border border-slate-100 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
                <div className={`p-1.5 rounded-lg ${iconBg}`}>
                  <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
                </div>
              </div>
              <p className={`text-2xl font-bold leading-tight ${valueColor}`}>{value}</p>
              <p className="text-xs text-slate-400 mt-1 leading-tight">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}