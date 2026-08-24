import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, GitBranch, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isAfter } from 'date-fns';
import { base44 } from '@/api/base44Client';
import PermissionGuard from '@/components/shared/PermissionGuard';

const DIM_LABELS = {
  governanca: 'Governança', juridico: 'Jurídico', controles_internos: 'Controles Internos',
  financeiro: 'Financeiro', contabil: 'Contábil', tributario: 'Fiscal/Tributário',
  operacional: 'Operacional', sistemas: 'Tecnologia',
};

/**
 * @param {Object} props
 * @param {any=} props.assessment
 * @param {any=} props.plan
 * @param {any=} props.tasks
 * @param {any=} props.reviews
 * @param {any=} props.onAddTask
 * @param {any=} props.onRegenerate
 * @param {any=} props.isRegenerating
 */
export default function APlanHeader({ assessment, plan, tasks, reviews, onAddTask, onRegenerate, isRegenerating }) {
  const navigate = useNavigate();
  const [creatingReview, setCreatingReview] = useState(false);
  
  const active = tasks.filter(t => t.status !== 'cancelled');
  const done = active.filter(t => t.status === 'done').length;
  const inProgress = active.filter(t => t.status === 'in_progress').length;
  const blocked = active.filter(t => t.status === 'blocked' || t.is_blocked).length;
  const today = new Date();
  const overdue = active.filter(t => t.due_date && t.status !== 'done' && isAfter(today, new Date(t.due_date))).length;
  const pct = active.length ? Math.round((done / active.length) * 100) : 0;
  const lastReview = (reviews || []).filter(r => r.status === 'completed').at(-1);

  const handleStartReview = async () => {
    setCreatingReview(true);
    try {
      const res = await base44.functions.invoke('createActionPlanReviewWithSnapshot', {
        action_plan_id: plan.id,
        review_date: new Date().toISOString().split('T')[0],
        visit_type: 'intermediate',
      });

      const data = res.data || res;
      if (data?.review?.id) {
        // Redireciona seja revisão existente ou nova
        navigate(`/assessment/${assessment.id}/action-plan/review/${data.review.id}`);
      } else {
        alert('Não foi possível criar ou localizar a revisão. Tente novamente.');
      }
    } catch (err) {
      console.error('Erro ao iniciar revisão:', err);
      alert('Erro ao iniciar revisão. Tente novamente.');
    } finally {
      setCreatingReview(false);
    }
  };

  const backUrl = assessment?.id ? `/AssessmentDetail?id=${assessment.id}` : '/Groups';

  const targetName = assessment?.display_name || assessment?.title || 'Diagnóstico';
  const planStatus = plan?.status || 'active';
  const planStatusLabel = { draft: 'Rascunho', active: 'Ativo', completed: 'Concluído', archived: 'Arquivado' }[planStatus] || planStatus;
  const planStatusCls = { active: 'bg-emerald-100 text-emerald-700', draft: 'bg-amber-100 text-amber-700', completed: 'bg-blue-100 text-blue-700', archived: 'bg-slate-100 text-slate-500' }[planStatus] || 'bg-slate-100 text-slate-600';

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-4">
      {/* Breadcrumb */}
      <Link to={backUrl} className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mb-3 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        Voltar ao diagnóstico
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-xl font-bold text-slate-900">Central do Plano de Ação</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${planStatusCls}`}>{planStatusLabel}</span>
          </div>
          <p className="text-sm text-slate-500 truncate">{targetName}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          <PermissionGuard area="actionplan">
            <Button size="sm" variant="outline" onClick={onAddTask} className="gap-1.5 text-slate-600">
              <Plus className="w-3.5 h-3.5" /> Nova tarefa
            </Button>
          </PermissionGuard>
          <PermissionGuard area="reviews">
            <Button 
              size="sm" 
              onClick={handleStartReview}
              disabled={creatingReview}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
            >
              <GitBranch className="w-3.5 h-3.5" /> {creatingReview ? 'Abrindo...' : 'Nova revisão'}
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-slate-500">Progresso geral</span>
          <span className="text-sm font-bold text-slate-800">{pct}%</span>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: pct >= 80 ? '#22c55e' : pct >= 40 ? '#3b82f6' : '#f59e0b' }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mt-4">
        {[
          { label: 'Total', value: active.length, cls: 'text-slate-700' },
          { label: 'Concluídas', value: done, cls: 'text-emerald-600' },
          { label: 'Em andamento', value: inProgress, cls: 'text-blue-600' },
          { label: 'Bloqueadas', value: blocked, cls: 'text-amber-600' },
          { label: 'Vencidas', value: overdue, cls: 'text-red-600' },
          { label: 'Sem responsável', value: active.filter(t => !t.assigned_to && !t.owner_name && t.status !== 'done').length, cls: 'text-slate-500' },
          { label: 'Sem prazo', value: active.filter(t => !t.due_date && t.status !== 'done').length, cls: 'text-slate-500' },
          { label: 'Sem evidência', value: active.filter(t => !t.expected_evidence && t.status !== 'done').length, cls: 'text-slate-500' },
        ].map(s => (
          <div key={s.label} className="text-center">
            <p className={`text-lg font-black ${s.cls}`}>{s.value}</p>
            <p className="text-[9px] text-slate-400 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}