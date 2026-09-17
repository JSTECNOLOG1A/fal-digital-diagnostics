/**
 * ActionPlanEmbed — Resumo executivo do plano de ação dentro do AssessmentDetail.
 * Exibe apenas métricas e botão "Gerenciar Plano de Ação".
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { assessmentKey, invalidateActionPlanQueries } from '@/lib/query-client';
import { useTenant } from '@/components/shared/TenantContext';
import {
  Zap, RefreshCw, ExternalLink, CheckCircle2,
  Clock, Lock, AlertTriangle, TrendingUp, Target
} from 'lucide-react';
import { isAfter } from 'date-fns';

/**
 * @param {Object} props
 * @param {any=} props.assessmentId
 */
export default function ActionPlanEmbed({ assessmentId }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const [generating, setGenerating] = useState(false);

  const { data: plans = [] } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId, 'action-plan'),
    queryFn: () => base44.entities.ActionPlan.filter({ assessment_id: assessmentId }, '-created_date', 1),
    enabled: !!assessmentId,
  });
  const plan = plans[0] || null;

  const { data: tasks = [] } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId, 'action-tasks', plan?.id),
    queryFn: () => base44.entities.ActionTask.filter({ plan_id: plan.id }, '-priority_score', 300),
    enabled: !!plan?.id,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId, 'action-plan-reviews', plan?.id),
    queryFn: () => base44.entities.ActionPlanReview.filter({ action_plan_id: plan.id }, 'review_number', 50),
    enabled: !!plan?.id,
  });

  const handleGenerate = async () => {
    setGenerating(true);
    await base44.functions.invoke('generateActionPlan', { assessmentId, cycleId: null });
    await invalidateActionPlanQueries(qc, assessmentId, plan?.id, tenantId);
    setGenerating(false);
  };

  const goToCentral = () => navigate(`/assessment/${assessmentId}/action-plan`);

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
        <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
          <Zap className="w-7 h-7 text-blue-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-600 mb-1">Nenhum plano de ação gerado</p>
          <p className="text-xs text-slate-400">Gere o plano para criar tarefas priorizadas automaticamente</p>
        </div>
        <Button onClick={handleGenerate} disabled={generating} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 mt-1">
          <Zap className="w-4 h-4" /> {generating ? 'Gerando...' : 'Gerar Plano de Ação'}
        </Button>
      </div>
    );
  }

  // Compute stats
  const active = tasks.filter(t => t.status !== 'cancelled');
  const done = active.filter(t => t.status === 'done').length;
  const inProgress = active.filter(t => t.status === 'in_progress').length;
  const blocked = active.filter(t => t.status === 'blocked' || t.is_blocked).length;
  const today = new Date();
  const overdue = active.filter(t => t.due_date && t.status !== 'done' && isAfter(today, new Date(t.due_date))).length;
  const pct = active.length ? Math.round((done / active.length) * 100) : 0;
  const lastReview = reviews.filter(r => r.status === 'completed').at(-1);

  const stats = [
    { label: 'Total', value: active.length, cls: 'text-slate-700', bg: 'bg-slate-50', icon: Target },
    { label: 'Concluídas', value: done, cls: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle2 },
    { label: 'Em andamento', value: inProgress, cls: 'text-blue-700', bg: 'bg-blue-50', icon: TrendingUp },
    { label: 'Bloqueadas', value: blocked, cls: 'text-amber-700', bg: 'bg-amber-50', icon: Lock },
    { label: 'Vencidas', value: overdue, cls: 'text-red-700', bg: 'bg-red-50', icon: AlertTriangle },
    { label: 'Revisões', value: reviews.filter(r => r.status === 'completed').length, cls: 'text-indigo-700', bg: 'bg-indigo-50', icon: Clock },
  ];

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-600">Progresso geral do plano</span>
          <span className="text-sm font-bold text-slate-800">{pct}%</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: pct >= 80 ? '#22c55e' : pct >= 40 ? '#3b82f6' : '#f59e0b' }}
          />
        </div>
        {lastReview && (
          <p className="text-[10px] text-slate-400 mt-2">
            Última revisão: {new Date(String(lastReview.review_date).slice(0, 10) + 'T12:00').toLocaleDateString('pt-BR')} · Rev. Nº{lastReview.review_number}
          </p>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {stats.map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-3 flex flex-col gap-1`}>
            <s.icon className={`w-4 h-4 ${s.cls}`} />
            <p className={`text-xl font-black ${s.cls}`}>{s.value}</p>
            <p className="text-[9px] text-slate-400 font-medium leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          onClick={goToCentral}
          className="flex-1 sm:flex-none gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
        >
          <ExternalLink className="w-4 h-4" />
          Gerenciar Plano de Ação
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleGenerate}
          disabled={generating}
          className="gap-1.5 text-slate-600"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
          Regerar
        </Button>
      </div>
    </div>
  );
}