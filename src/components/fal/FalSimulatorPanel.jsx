import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import { assessmentKey, actionPlanKey } from '@/lib/query-client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2, Zap, TrendingUp, ShieldCheck, DollarSign,
  ArrowRight, BarChart3, ChevronDown, ChevronRight, ExternalLink
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const SCENARIO_COLORS = ['#3b82f6', '#f59e0b', '#10b981'];
const SCENARIO_LABELS = ['Cenário 1', 'Cenário 2', 'Cenário 3'];

const IMPACT_COLOR = {
  ALTO:  'text-emerald-700 bg-emerald-50 border-emerald-300',
  MÉDIO: 'text-yellow-700 bg-yellow-50 border-yellow-300',
  BAIXO: 'text-slate-500 bg-slate-50 border-slate-300',
};

const PRIORITY_COLOR = {
  'CRÍTICA': 'bg-red-100 text-red-700',
  'ALTA':    'bg-orange-100 text-orange-700',
  'MÉDIA':   'bg-yellow-100 text-yellow-700',
  'BAIXA':   'bg-slate-100 text-slate-500',
};

/**
 * @param {Object} props
 * @param {any=} props.label
 * @param {any=} props.current
 * @param {any=} props.simulated
 * @param {any=} props.color
 */
function ScoreBar({ label, current, simulated, color }) {
  const maxScore = 3;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-600 capitalize">{label.replace(/_/g,' ')}</span>
        <span className="font-semibold text-slate-700">
          {current.toFixed(2)} → <span style={{ color }}>{simulated.toFixed(2)}</span>
          <span className="text-emerald-600 ml-1">(+{(simulated - current).toFixed(2)})</span>
        </span>
      </div>
      <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="absolute h-full bg-slate-300 rounded-full" style={{ width: `${(current / maxScore) * 100}%` }} />
        <div className="absolute h-full rounded-full transition-all duration-500" style={{ width: `${(simulated / maxScore) * 100}%`, backgroundColor: color, opacity: 0.7 }} />
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.sim
 * @param {any=} props.color
 * @param {any=} props.isSelected
 * @param {any=} props.onSelect
 */
function ScenarioCard({ sim, color, isSelected, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const clusters = Object.values(sim.cluster_details || {});
  const delta = sim.delta_score;

  return (
    <div
      className={`border-2 rounded-xl overflow-hidden cursor-pointer transition-all ${isSelected ? 'border-blue-500 shadow-lg' : 'border-slate-200 hover:border-slate-300'}`}
      onClick={onSelect}
    >
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{sim.simulation_label?.split('—')[0]?.trim()}</p>
            <p className="text-sm text-slate-600 mt-0.5">{sim.simulation_label?.split('—')[1]?.trim()}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold" style={{ color }}>+{delta.toFixed(2)}</p>
            <p className="text-[10px] text-slate-400">delta score</p>
          </div>
        </div>

        {/* Score visual */}
        <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
          <div className="text-center">
            <p className="text-lg font-bold text-slate-600">{sim.current_overall_score?.toFixed(2)}</p>
            <p className="text-[10px] text-slate-400">Atual</p>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400" />
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color }}>{sim.simulated_overall_score?.toFixed(2)}</p>
            <p className="text-[10px] text-slate-400">Projetado</p>
          </div>
          <div className="flex-1">
            <div className="relative h-3 bg-slate-200 rounded-full overflow-hidden">
              <div className="absolute h-full bg-slate-400 rounded-full" style={{ width: `${(sim.current_overall_score / 3) * 100}%` }} />
              <div className="absolute h-full rounded-full" style={{ width: `${(sim.simulated_overall_score / 3) * 100}%`, backgroundColor: color, opacity: 0.6 }} />
            </div>
          </div>
        </div>

        {/* Impact badges */}
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: 'Financeiro', value: sim.estimated_financial_impact, IconComp: DollarSign },
            { label: 'Risco', value: sim.estimated_risk_reduction, IconComp: ShieldCheck },
            { label: 'Operacional', value: sim.estimated_operational_gain, IconComp: TrendingUp },
          ].map(({ label, value, IconComp }) => (
            <div key={label} className={`text-center p-1.5 rounded-lg border text-xs font-semibold ${IMPACT_COLOR[value] || IMPACT_COLOR.BAIXO}`}>
              <IconComp className="w-3 h-3 mx-auto mb-0.5" />
              {value}
            </div>
          ))}
        </div>
      </div>

      {/* Clusters list toggle */}
      <div className="border-t">
        <button
          onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}
          className="w-full flex items-center justify-between px-4 py-2 text-xs text-slate-500 hover:bg-slate-50"
        >
          <span>{clusters.length} clusters simulados</span>
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        {expanded && (
          <div className="px-4 pb-3 space-y-1.5 max-h-48 overflow-y-auto">
            {clusters.map(c => (
              <div key={c.cluster_key || Math.random()} className="flex items-center justify-between text-xs">
                <span className="text-slate-600 capitalize truncate max-w-[60%]">{String(c.cluster_key || '').replace(/_/g,' ')}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${PRIORITY_COLOR[c.priority_level] || PRIORITY_COLOR.BAIXA}`}>
                    {c.priority_level}
                  </span>
                  <span className="text-slate-500">{c.current_score?.toFixed(1)}</span>
                  <span className="text-slate-300">→</span>
                  <span className="font-semibold text-emerald-600">{c.simulated_score?.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const PRIORITY_TASK_STYLE = {
  critical: { dot: 'bg-red-500', badge: 'bg-red-100 text-red-700', label: 'Crítico' },
  high:     { dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700', label: 'Alta' },
  medium:   { dot: 'bg-blue-400', badge: 'bg-blue-100 text-blue-700', label: 'Média' },
  low:      { dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600', label: 'Baixa' },
};

/**
 * @param {Object} props
 * @param {any=} props.assessmentId
 * @param {any=} props.snapshot
 */
export default function FalSimulatorPanel({ assessmentId, snapshot: snapshotProp }) {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const [simulating, setSimulating] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState(0);
  const [error, setError] = useState(null);

  // Fetch snapshot from cache — avoids blank panel when prop is not yet available
  const { data: cachedSnapshot } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId, 'fal-snapshot-full'),
    queryFn: async () => {
      const snaps = await base44.entities.FalDiagnosticSnapshot.filter({ assessment_id: assessmentId }, '-computed_at', 1);
      return snaps[0] || null;
    },
    enabled: !!assessmentId && !snapshotProp,
    staleTime: 60_000,
  });

  const snapshot = snapshotProp || cachedSnapshot;

  // Buscar plano de ação e tarefas prioritárias
  const { data: plans = [] } = useQuery({
    queryKey: actionPlanKey(tenantId, assessmentId, null, 'meta'),
    queryFn: () => base44.entities.ActionPlan.filter({ assessment_id: assessmentId }, '-created_date', 1),
    enabled: !!assessmentId,
  });
  const plan = plans[0] || null;

  const { data: tasks = [] } = useQuery({
    queryKey: actionPlanKey(tenantId, assessmentId, plan?.id, 'tasks'),
    queryFn: () => base44.entities.ActionTask.filter({ plan_id: plan.id }, '-priority_score', 20),
    enabled: !!plan?.id,
  });

  // Top 5 tarefas críticas/alta prioridade ainda abertas
  const topTasks = tasks
    .filter(t => t.status !== 'done' && t.status !== 'cancelled')
    .filter(t => t.priority === 'critical' || t.priority === 'high')
    .slice(0, 5);

  const { data: simulations = [], isLoading } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId, 'fal-simulations'),
    queryFn: () => base44.entities.FalImpactSimulation.filter({ assessment_id: assessmentId }, 'created_at', 10),
    enabled: !!assessmentId,
  });

  const handleSimulate = async () => {
    setSimulating(true);
    setError(null);
    const res = await base44.functions.invoke('simulateFalImpact', { assessment_id: assessmentId });
    if (res.data?.error) setError(res.data.error);
    else queryClient.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId, 'fal-simulations') });
    setSimulating(false);
  };

  const hasSimulations = simulations.length > 0;
  const currentScore = snapshot?.overall_score ?? 0;

  // Gráfico de evolução
  const evolutionData = [
    { name: 'Atual', score: currentScore, fill: '#94a3b8' },
    ...simulations.slice(0, 3).map((s, i) => ({
      name: SCENARIO_LABELS[i],
      score: s.simulated_overall_score ?? currentScore,
      fill: SCENARIO_COLORS[i],
    })),
  ];

  // Gráfico de dimensões para o cenário selecionado
  const selectedSim = simulations[selectedScenario];
  const dimensionChartData = selectedSim
    ? Object.entries(selectedSim.expected_dimension_scores || {})
        .filter(([, d]) => d.current > 0 || d.simulated > 0)
        .map(([dim, d]) => ({
          dim: dim.replace(/_/g,' ').substring(0, 14),
          Atual: d.current,
          Projetado: d.simulated,
        }))
        .sort((a, b) => b.Projetado - a.Projetado)
    : [];

  if (!snapshot && !simulating && !isLoading) return (
    <div className="text-center py-12 text-slate-400">
      <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-400 rounded-full animate-spin mx-auto mb-3" />
      <p className="text-sm">Carregando dados do diagnóstico...</p>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" /> Simulador de Impacto
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Projete a evolução do score ao implementar as ações prioritárias</p>
        </div>
        <Button size="sm" variant="outline" onClick={handleSimulate} disabled={simulating} className="gap-1.5">
          {simulating
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Simulando...</>
            : <><Zap className="w-3.5 h-3.5" /> {hasSimulations ? 'Recalcular' : 'Gerar Simulação'}</>}
        </Button>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}

      {!hasSimulations && !simulating && !isLoading && (
        <div className="text-center py-12 text-slate-400">
          <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Clique em "Gerar Simulação" para projetar cenários de melhoria.</p>
          <p className="text-xs mt-1">Requer diagnóstico e priorização calculados.</p>
        </div>
      )}

      {(simulating || isLoading) && (
        <div className="text-center py-8 text-slate-400">
          <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
          <p className="text-sm">Calculando cenários...</p>
        </div>
      )}

      {/* Ações prioritárias relacionadas */}
      {topTasks.length > 0 && (
        <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-yellow-500" /> Ações Prioritárias Relacionadas
            </p>
            <Link
              to={createPageUrl(`ActionPlanPage?assessment_id=${assessmentId}`)}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
            >
              Ver plano completo <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {topTasks.map(task => {
              const p = PRIORITY_TASK_STYLE[task.priority] || PRIORITY_TASK_STYLE.medium;
              return (
                <div key={task.id} className="flex items-center gap-2.5 bg-white rounded-lg border border-slate-200 px-3 py-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.dot}`} />
                  <p className="text-xs text-slate-700 flex-1 leading-snug truncate">{task.title}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${p.badge}`}>{p.label}</span>
                  {task.horizon && (
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{task.horizon}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hasSimulations && !isLoading && (
        <>
          {/* Gráfico de evolução geral */}
          <Card className="p-4">
            <p className="text-xs font-semibold text-slate-600 mb-3 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4" /> Evolução Projetada do Score Geral
            </p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={evolutionData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 3]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => Number(v).toFixed(2)} />
                <Bar dataKey="score" radius={[4,4,0,0]}>
                  {evolutionData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Cards de cenários */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {simulations.slice(0, 3).map((sim, i) => (
              <ScenarioCard
                key={sim.id}
                sim={sim}
                color={SCENARIO_COLORS[i]}
                isSelected={selectedScenario === i}
                onSelect={() => setSelectedScenario(i)}
              />
            ))}
          </div>

          {/* Detalhamento por dimensão do cenário selecionado */}
          {selectedSim && dimensionChartData.length > 0 && (
            <Card className="p-4 space-y-4">
              <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                Impacto por Dimensão — {selectedSim.simulation_label?.split('—')[0]?.trim()}
              </p>

              {/* Bar chart comparativo */}
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dimensionChartData} layout="vertical" margin={{ top: 0, right: 16, left: 80, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" domain={[0, 3]} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="dim" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip formatter={(v) => Number(v).toFixed(2)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Atual" fill="#cbd5e1" radius={[0,2,2,0]} />
                  <Bar dataKey="Projetado" fill={SCENARIO_COLORS[selectedScenario]} radius={[0,2,2,0]} opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>

              {/* Score bars detalhadas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                {Object.entries(selectedSim.expected_dimension_scores || {})
                  .filter(([, d]) => d.delta > 0)
                  .sort(([, a], [, b]) => b.delta - a.delta)
                  .map(([dim, d]) => (
                    <ScoreBar
                      key={dim}
                      label={dim}
                      current={d.current}
                      simulated={d.simulated}
                      color={SCENARIO_COLORS[selectedScenario]}
                    />
                  ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}