import React from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, Target, AlertTriangle, CheckSquare, Zap } from 'lucide-react';

/**
 * @param {Object} props
 * @param {any=} props.value
 * @param {any=} props.suffix
 */
function DeltaSign({ value, suffix = '' }) {
  if (value === null || value === undefined) return <span className="text-slate-400">—</span>;
  const sign = value > 0 ? '+' : '';
  const color = value > 0 ? 'text-emerald-600' : value < 0 ? 'text-red-500' : 'text-slate-500';
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  return (
    <span className={`flex items-center gap-1 ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      {sign}{typeof value === 'number' ? value.toFixed(2) : value}{suffix}
    </span>);

}

/**
 * @param {Object} props
 * @param {any=} props.icon
 * @param {any=} props.iconBg
 * @param {any=} props.iconColor
 * @param {any=} props.label
 * @param {any=} props.value
 * @param {any=} props.sub
 * @param {any=} props.loading
 */
function KPICard({ icon: Icon, iconBg, iconColor, label, value, sub, loading }) {
  return (
    <Card className="border-0 shadow-sm">
      
















      
    </Card>);

}

/**
 * @param {Object} props
 * @param {any=} props.snapshots
 * @param {any=} props.actionTasks
 * @param {any=} props.simulations
 * @param {any=} props.loading
 */
export default function ExecutiveKPIs({ snapshots = [], actionTasks = [], simulations = [], loading = false }) {
  // Use the most recent snapshot with an overall_score
  const snap = snapshots.find((s) => s.overall_score !== null && s.overall_score !== undefined) || snapshots[0];

  // KPI 1: Maturity Index
  const maturityIndex = snap?.maturity_index !== undefined && snap?.maturity_index !== null ?
  snap.maturity_index :
  snap?.overall_score !== null && snap?.overall_score !== undefined ? Math.round(snap.overall_score / 3 * 100) : null;

  // KPI 2: Total Evolution
  const totalEvolution = snap?.total_evolution !== undefined ? snap.total_evolution : null;

  // KPI 3: Critical clusters
  const criticalCount = snap?.critical_clusters_count ?? null;
  const totalClusters = snap?.total_clusters_count ?? null;

  // KPI 4: Action execution rate
  let actionRate = snap?.action_execution_rate ?? null;
  if (actionRate === null && actionTasks.length > 0) {
    const done = actionTasks.filter((t) => t.status === 'done').length;
    actionRate = Math.round(done / actionTasks.length * 100);
  }

  // KPI 5: Impact potential
  let impactPotential = snap?.impact_potential ?? null;
  if (impactPotential === null && simulations.length > 0) {
    const latest = simulations[simulations.length - 1];
    impactPotential = latest?.delta_score ?? null;
  }

  const hasAnyData = !!snap;

  if (!hasAnyData && !loading) return null;

  return (
    <div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KPICard
          icon={Target}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          label="Maturidade Atual"
          value={maturityIndex !== null ? `${maturityIndex}%` : '—'}
          sub={snap?.overall_level || ''}
          loading={loading} />
        
        <KPICard
          icon={TrendingUp}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          label="Evolução Total"
          value={
          totalEvolution !== null ?
          <DeltaSign value={totalEvolution} /> :
          <span className="text-slate-400 text-lg">—</span>
          }
          sub="desde o 1º diagnóstico"
          loading={loading} />
        
        <KPICard
          icon={AlertTriangle}
          iconBg="bg-red-50"
          iconColor="text-red-500"
          label="Clusters Críticos"
          value={
          criticalCount !== null ?
          `${criticalCount}${totalClusters ? ` / ${totalClusters}` : ''}` :
          '—'
          }
          sub="score < 1.0"
          loading={loading} />
        
        <KPICard
          icon={CheckSquare}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
          label="Execução do Plano"
          value={actionRate !== null ? `${actionRate}%` : '—'}
          sub={actionTasks.length > 0 ? `${actionTasks.filter((t) => t.status === 'done').length} / ${actionTasks.length} tarefas` : 'sem plano'}
          loading={loading} />
        
        <KPICard
          icon={Zap}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          label="Impacto Potencial"
          value={
          impactPotential !== null ?
          <DeltaSign value={impactPotential} /> :
          <span className="text-slate-400 text-lg">—</span>
          }
          sub="ganho estimado simulador"
          loading={loading} />
        
      </div>
    </div>);

}