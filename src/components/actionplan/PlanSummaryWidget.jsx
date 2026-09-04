/**
 * PlanSummaryWidget
 * Bloco resumo executivo do plano de ação para exibir no AssessmentDetail.
 * Mostra KPIs e botão "Gerenciar Plano de Ação".
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  CheckCircle2, Clock, Lock, AlertTriangle, TrendingUp, Zap
} from 'lucide-react';
import { isAfter } from 'date-fns';
import { assessmentKey } from '@/lib/query-client';

/**
 * @param {Object} props
 * @param {any=} props.assessmentId
 * @param {any=} props.tenantId
 * @param {any=} props.onGenerate
 * @param {any=} props.generating
 */
export default function PlanSummaryWidget({ assessmentId, tenantId, onGenerate, generating }) {
  const { data: plans = [], isLoading: loadingPlan } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId, 'action-plan'),
    queryFn: () => base44.entities.ActionPlan.filter({ assessment_id: assessmentId, tenant_id: tenantId }, '-generated_at', 1),
    enabled: !!assessmentId && !!tenantId,
  });

  const plan = plans[0] || null;
  const planId = plan?.id;

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId, 'action-tasks', planId),
    queryFn: () => base44.entities.ActionTask.filter({ plan_id: planId, tenant_id: tenantId }, '-priority_score', 300),
    enabled: !!planId,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId, 'action-plan-reviews', planId),
    queryFn: () => base44.entities.ActionPlanReview.filter({ action_plan_id: planId, tenant_id: tenantId }, '-review_date', 10),
    enabled: !!planId,
  });

  if (loadingPlan) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center text-slate-400">
        <Clock className="w-5 h-5 mx-auto mb-1 animate-pulse" />
        <p className="text-xs">Carregando plano de ação...</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
          <Zap className="w-5 h-5 text-blue-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-700">Nenhum plano de ação gerado</p>
          <p className="text-xs text-slate-400 mt-0.5">Conclua o diagnóstico para gerar o plano automaticamente</p>
        </div>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors disabled:opacity-60"
        >
          <Zap className="w-3.5 h-3.5" />
          {generating ? 'Gerando...' : 'Gerar Plano de Ação'}
        </button>
      </div>
    );
  }

  const active = tasks.filter(t => t.status !== 'cancelled');
  const done = active.filter(t => t.status === 'done').length;
  const inProgress = active.filter(t => t.status === 'in_progress').length;
  const blocked = active.filter(t => t.status === 'blocked' || t.is_blocked).length;
  const today = new Date();
  const overdue = active.filter(t => t.due_date && t.status !== 'done' && isAfter(today, new Date(t.due_date))).length;
  const noOwner = active.filter(t => !t.assigned_to && !t.owner_name).length;
  const noDate = active.filter(t => !t.due_date && t.status !== 'done').length;
  const pct = active.length ? Math.round((done / active.length) * 100) : 0;
  const lastReview = reviews.filter(r => r.status === 'completed').at(-1);

  const stats = [
    { label: 'Total', value: active.length, cls: 'text-slate-700 bg-slate-50', icon: TrendingUp },
    { label: 'Concluídas', value: done, cls: 'text-emerald-700 bg-emerald-50', icon: CheckCircle2 },
    { label: 'Em andamento', value: inProgress, cls: 'text-blue-700 bg-blue-50', icon: Clock },
    { label: 'Bloqueadas', value: blocked, cls: blocked > 0 ? 'text-amber-700 bg-amber-50' : 'text-slate-400 bg-slate-50', icon: Lock },
    { label: 'Vencidas', value: overdue, cls: overdue > 0 ? 'text-red-700 bg-red-50' : 'text-slate-400 bg-slate-50', icon: AlertTriangle },
    { label: 'Sem responsável', value: noOwner, cls: noOwner > 0 ? 'text-orange-600 bg-orange-50' : 'text-slate-400 bg-slate-50', icon: AlertTriangle },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Progress bar top */}
      <div className="h-1.5 bg-slate-100">
        <div
          className="h-full transition-all duration-500 rounded-full"
          style={{ width: `${pct}%`, background: pct >= 80 ? '#22c55e' : pct >= 40 ? '#3b82f6' : '#f59e0b' }}
        />
      </div>

      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Plano de Ação</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {active.length} tarefas · {pct}% concluído
              {lastReview ? ` · Última revisão: ${new Date(String(lastReview.review_date).slice(0, 10) + 'T12:00').toLocaleDateString('pt-BR')}` : ''}
            </p>
          </div>
          <span className="text-lg font-black text-slate-800">{pct}%</span>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2">
          {stats.map(s => (
            <div key={s.label} className={`rounded-xl p-2.5 ${s.cls} flex flex-col gap-0.5`}>
              <p className="text-lg font-black">{s.value}</p>
              <p className="text-[10px] font-medium leading-tight">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Alerts */}
        {(noOwner > 0 || noDate > 0 || overdue > 0 || blocked > 0) && (
          <div className="space-y-1">
            {overdue > 0 && <div className="flex items-center gap-1.5 text-xs text-red-600"><AlertTriangle className="w-3.5 h-3.5" />{overdue} tarefa{overdue > 1 ? 's' : ''} vencida{overdue > 1 ? 's' : ''}</div>}
            {blocked > 0 && <div className="flex items-center gap-1.5 text-xs text-amber-600"><Lock className="w-3.5 h-3.5" />{blocked} tarefa{blocked > 1 ? 's' : ''} bloqueada{blocked > 1 ? 's' : ''}</div>}
            {noOwner > 0 && <div className="flex items-center gap-1.5 text-xs text-orange-600"><AlertTriangle className="w-3.5 h-3.5" />{noOwner} tarefa{noOwner > 1 ? 's' : ''} sem responsável</div>}
            {noDate > 0 && <div className="flex items-center gap-1.5 text-xs text-slate-500"><Clock className="w-3.5 h-3.5" />{noDate} tarefa{noDate > 1 ? 's' : ''} sem prazo</div>}
          </div>
        )}


      </div>
    </div>
  );
}