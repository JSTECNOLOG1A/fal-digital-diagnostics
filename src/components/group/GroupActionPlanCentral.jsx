/**
 * GroupActionPlanCentral — Adaptador do Plano de Ação para a aba do Grupo
 * Localiza Assessment 8D + ActionPlan e renderiza a central madura existente.
 * NÃO recria Kanban, Lista, Cronograma, Pendências, Revisões ou Drawer.
 */
import React, { useState } from 'react';
import { assessmentKey, tenantKey } from '@/lib/query-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LayoutDashboard, Loader2, ArrowRight, Columns, List, Clock,
  GitBranch, AlertTriangle, TrendingUp, Lightbulb
} from 'lucide-react';
import DimensionEvolutionChart from '@/components/actionplan/DimensionEvolutionChart';
import ReviewEvolutionChart from '@/components/group/ReviewEvolutionChart';
import { ReviewModeProvider, useReviewMode } from '@/context/ReviewModeContext';
import ReviewModeBanner from '@/components/actionplan/ReviewModeBanner';
import HistoricalPositionTab from '@/components/actionplan/HistoricalPositionTab';
import ReviewComparisonTab from '@/components/actionplan/ReviewComparisonTab';
import APlanHeader from '@/components/actionplan/central/APlanHeader';
import ListaExecutivaTab from '@/components/actionplan/central/ListaExecutivaTab';
import CronogramaTab from '@/components/actionplan/central/CronogramaTab';
import DependenciesTab from '@/components/actionplan/central/DependenciesTab';
import PendenciasTab from '@/components/actionplan/central/PendenciasTab';
import TaskFullDrawer from '@/components/actionplan/central/TaskFullDrawer';
import KanbanTab from '@/components/actionplan/KanbanTab';
import ActionPlanReviewTimeline from '@/components/fal/ActionPlanReviewTimeline';
import AddManualTaskModal from '@/components/fal/AddManualTaskModal';
import RecommendationsTab from '@/components/actionplan/RecommendationsTab';
import { useTaxReformMethodVersion } from '@/lib/hooks/useTaxReformMethodVersion';

const PLAN_TABS = [
  { key: 'dashboard',       label: 'Dashboard',         icon: TrendingUp },
  { key: 'recommendations', label: 'Recomendações',     icon: Lightbulb },
  { key: 'kanban',          label: 'Kanban',            icon: Columns },
  { key: 'lista',           label: 'Lista Executiva',   icon: List },
  { key: 'cronograma',      label: 'Cronograma',        icon: Clock },
  { key: 'dependencias',    label: 'Dependências',      icon: GitBranch },
  { key: 'historico',       label: 'Posição Histórica', icon: Clock },
  { key: 'comparativo',     label: 'Comparativo',       icon: TrendingUp },
  { key: 'revisoes',        label: 'Revisões',          icon: GitBranch },
  { key: 'pendencias',      label: 'Pendências',        icon: AlertTriangle },
];

/**
 * @param {Object} props
 * @param {any=} props.assessmentId
 * @param {any=} props.tenantId
 * @param {any=} props.onGo8D
 */
function ActionPlanCentralContent({ assessmentId, tenantId, onGo8D }) {
  const qc = useQueryClient();
  const { isReviewMode } = useReviewMode();
  const [activeTab, setActiveTab] = useState('lista');
  const [selectedTask, setSelectedTask] = useState(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const { data: assessment } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId),
    queryFn: () => base44.entities.Assessment.get(assessmentId),
    enabled: !!assessmentId,
  });

  const { data: plans = [], isLoading: loadingPlan } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId, 'action-plan'),
    queryFn: () => base44.entities.ActionPlan.filter({ assessment_id: assessmentId, tenant_id: tenantId }, '-generated_at', 1),
    enabled: !!assessmentId && !!tenantId,
  });
  const plan = plans[0] || null;
  const planId = plan?.id || null;

  const { data: tasks = [] } = useQuery({
    queryKey: tenantKey(tenantId, 'action-tasks', planId),
    queryFn: () => base44.entities.ActionTask.filter({ plan_id: planId, tenant_id: tenantId }, '-priority_score', 500),
    enabled: !!planId && !!tenantId,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: tenantKey(tenantId, 'action-plan-reviews', planId),
    queryFn: () => base44.entities.ActionPlanReview.filter({ action_plan_id: planId, tenant_id: tenantId }, '-review_date', 50),
    enabled: !!planId && !!tenantId,
  });

  const invalidateTasks = () => qc.invalidateQueries({ queryKey: tenantKey(tenantId, 'action-tasks', planId) });
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: tenantKey(tenantId, 'action-tasks', planId) });
    qc.invalidateQueries({ queryKey: tenantKey(tenantId, 'action-plan-reviews', planId) });
  };

  const activeTasks = tasks.filter(t => t.status !== 'cancelled' && t.status !== 'done');
  const pendenciasCount = activeTasks.filter(t =>
    (!t.assigned_to && !t.owner_name) || !t.due_date || !t.expected_evidence ||
    (t.status === 'blocked' && !t.blocked_reason) ||
    (t.progress_percentage >= 100 && t.status !== 'done')
  ).length;

  if (loadingPlan) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando plano de ação...
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-4">
        <LayoutDashboard className="w-12 h-12 opacity-30" />
        <p className="text-sm font-semibold text-slate-900">Nenhum Plano de Ação encontrado para este Grupo</p>
        <p className="text-xs text-slate-500 max-w-xs text-center">O Plano de Ação é gerado a partir do Diagnóstico 8D.</p>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onGo8D}>
          <ArrowRight className="w-3.5 h-3.5" /> Ir para Diagnóstico 8D
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ minHeight: '70vh' }}>
      {isReviewMode && (
        <ReviewModeBanner assessment_id={assessmentId} plan_id={planId} />
      )}

      <APlanHeader
        assessment={assessment}
        plan={plan}
        tasks={tasks}
        reviews={reviews}
        onAddTask={() => setShowAddTask(true)}
        onRegenerate={null}
        isRegenerating={isRegenerating}
      />

      {/* Tab Navigation */}
      <div className="bg-white border-b border-slate-200 overflow-x-auto flex-shrink-0">
        <div className="flex gap-0 min-w-max px-1">
          {PLAN_TABS.map(tab => {
            const Icon = tab.icon;
            const isPendencias = tab.key === 'pendencias';
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {isPendencias && pendenciasCount > 0 && (
                  <span className="ml-1 bg-amber-500 text-white text-[9px] rounded-full px-1.5 py-0.5 font-bold">
                    {pendenciasCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            <DimensionEvolutionChart assessmentId={assessmentId} planId={planId} reviews={reviews} />
            <ReviewEvolutionChart
              baselineSnapshot={plan?.baseline_diagnostic_score != null ? { overall_score: plan.baseline_diagnostic_score, computed_at: plan.generated_at } : null}
              reviews={reviews}
            />
          </div>
        )}
        {activeTab === 'recommendations' && (
          <RecommendationsTab planId={planId} assessmentId={assessmentId} tenantId={tenantId} tasks={tasks} />
        )}
        {activeTab === 'kanban' && (
          <KanbanTab tasks={tasks} planId={planId} onOpenTask={setSelectedTask} />
        )}
        {activeTab === 'lista' && (
          <ListaExecutivaTab tasks={tasks} onOpenTask={setSelectedTask} planId={planId} tenantId={tenantId} />
        )}
        {activeTab === 'cronograma' && (
          <CronogramaTab tasks={tasks} onOpenTask={setSelectedTask} />
        )}
        {activeTab === 'dependencias' && (
          <DependenciesTab tasks={tasks} onOpenTask={setSelectedTask} />
        )}
        {activeTab === 'historico' && (
          <HistoricalPositionTab plan_id={planId} reviews={reviews} tenant_id={tenantId} />
        )}
        {activeTab === 'comparativo' && (
          <ReviewComparisonTab plan_id={planId} reviews={reviews} tenant_id={tenantId} />
        )}
        {activeTab === 'revisoes' && (
          <ActionPlanReviewTimeline planId={planId} tenantId={tenantId} />
        )}
        {activeTab === 'pendencias' && (
          <PendenciasTab tasks={tasks} onOpenTask={setSelectedTask} />
        )}
      </div>

      {selectedTask && (
        <TaskFullDrawer
          task={selectedTask}
          allTasks={tasks}
          planId={planId}
          tenantId={tenantId}
          onClose={() => setSelectedTask(null)}
          onSaved={() => { invalidateTasks(); setSelectedTask(null); }}
        />
      )}

      {showAddTask && (
        <AddManualTaskModal
          planId={planId}
          assessmentId={assessmentId}
          tenantId={tenantId}
          onClose={() => setShowAddTask(false)}
          onCreated={() => { invalidateTasks(); setShowAddTask(false); }}
        />
      )}
    </div>
  );
}

// Wrapper principal com busca robusta de assessment e ReviewModeProvider
/**
 * @param {Object} props
 * @param {any=} props.groupId
 * @param {any=} props.tenantId
 * @param {any=} props.onGo8D
 */
export default function GroupActionPlanCentral({ groupId, tenantId, onGo8D }) {
  // Esta aba é a Central do Plano de Ação do FAL 8D clássico. Precisa excluir
  // diagnósticos de métodos com banco de perguntas próprio (ex.: Reforma
  // Tributária 8D) do mesmo grupo, senão o predicado de seleção abaixo não
  // tem como desempatar entre os dois métodos. Não dá pra filtrar por
  // "method_version_id: null" porque o Assessment do FAL 8D normalmente já
  // aponta pra um MethodVersion real (via useTenant().methodVersion).
  const { methodVersion: taxReformMethodVersion, isLoading: loadingTaxReformMethod } = useTaxReformMethodVersion();
  const { data: byTarget = [], isLoading: l1 } = useQuery({
    queryKey: tenantKey(tenantId, 'aplan-by-target', groupId, 'fal8d'),
    queryFn: () => base44.entities.Assessment.filter(
      { target_type: 'group', target_id: groupId, tenant_id: tenantId }, '-created_date', 10
    ),
    enabled: !!groupId && !!tenantId,
  });
  const { data: byGroup = [], isLoading: l2 } = useQuery({
    queryKey: tenantKey(tenantId, 'aplan-by-group', groupId, 'fal8d'),
    queryFn: () => base44.entities.Assessment.filter(
      { group_id: groupId, tenant_id: tenantId }, '-created_date', 10
    ),
    enabled: !!groupId && !!tenantId,
  });

  const isLoading = l1 || l2 || loadingTaxReformMethod;

  const allAssessments = [...byTarget, ...byGroup];
  const unique = Array.from(new Map(allAssessments.map(a => [a.id, a])).values())
    .filter(a => (a.method_version_id || null) !== (taxReformMethodVersion?.id || '__none__'));
  const assessment =
    unique.find(a => a.status !== 'archived' && (a.assessment_mode === 'multi_entity_master' || a.target_type === 'group')) ||
    unique.find(a => a.status !== 'archived') ||
    null;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-4">
        <LayoutDashboard className="w-12 h-12 opacity-30" />
        <p className="text-sm font-semibold text-slate-900">Nenhum Diagnóstico 8D encontrado para este Grupo</p>
        <p className="text-xs text-slate-500">Inicie o Diagnóstico 8D antes de acessar o Plano de Ação.</p>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onGo8D}>
          <ArrowRight className="w-3.5 h-3.5" /> Ir para Diagnóstico 8D
        </Button>
      </div>
    );
  }

  return (
    <ReviewModeProvider assessment_id={assessment.id} review_id={null}>
      <ActionPlanCentralContent assessmentId={assessment.id} tenantId={tenantId} onGo8D={onGo8D} />
    </ReviewModeProvider>
  );
}