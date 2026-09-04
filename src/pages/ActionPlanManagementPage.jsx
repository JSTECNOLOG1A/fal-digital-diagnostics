/**
 * Central do Plano de Ação FAL
 * Rota: /assessment/:assessment_id/action-plan
 * Rota (com revisão): /assessment/:assessment_id/action-plan/review/:review_id
 */
import React, { useState } from 'react';
import { assessmentKey } from '@/lib/query-client';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import {
  Columns, List, Clock, GitBranch, AlertTriangle, LayoutDashboard, Loader2, TrendingUp, Lightbulb
} from 'lucide-react';
import DimensionEvolutionChart from '@/components/actionplan/DimensionEvolutionChart';
import ReviewEvolutionChart from '@/components/group/ReviewEvolutionChart';
import { ReviewModeProvider, useReviewMode } from '@/context/ReviewModeContext';
import ReviewModeBanner from '@/components/actionplan/ReviewModeBanner';
import HistoricalPositionTab from '@/components/actionplan/HistoricalPositionTab';
import ReviewComparisonTab from '@/components/actionplan/ReviewComparisonTab';

// Header & Tabs
import APlanHeader from '@/components/actionplan/central/APlanHeader';
import ListaExecutivaTab from '@/components/actionplan/central/ListaExecutivaTab';
import CronogramaTab from '@/components/actionplan/central/CronogramaTab';
import DependenciesTab from '@/components/actionplan/central/DependenciesTab';
import PendenciasTab from '@/components/actionplan/central/PendenciasTab';
import TaskFullDrawer from '@/components/actionplan/central/TaskFullDrawer';

// Existing components reused
import KanbanTab from '@/components/actionplan/KanbanTab';
import ActionPlanReviewTimeline from '@/components/fal/ActionPlanReviewTimeline';
import AddManualTaskModal from '@/components/fal/AddManualTaskModal';
import RecommendationsTab from '@/components/actionplan/RecommendationsTab';
import PermissionGuard from '@/components/shared/PermissionGuard';
import { usePermissions } from '@/lib/hooks/usePermissions';

const TABS = [
  { key: 'dashboard',       label: 'Dashboard',           icon: TrendingUp },
  { key: 'recommendations', label: 'Recomendações',       icon: Lightbulb },
  { key: 'kanban',          label: 'Kanban',              icon: Columns },
  { key: 'lista',           label: 'Lista Executiva',     icon: List },
  { key: 'cronograma',  label: 'Cronograma',          icon: Clock },
  { key: 'dependencias',label: 'Dependências',        icon: GitBranch },
  { key: 'historico',   label: 'Posição Histórica',   icon: Clock },
  { key: 'comparativo', label: 'Comparativo',         icon: TrendingUp },
  { key: 'revisoes',    label: 'Revisões',            icon: GitBranch },
  { key: 'pendencias',  label: 'Pendências',          icon: AlertTriangle },
];

function ActionPlanManagementPageInner() {
  const { assessment_id: assessmentId, review_id: reviewId } = useParams();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { isReviewMode } = useReviewMode();
  const { canWrite } = usePermissions();

  const [activeTab, setActiveTab] = useState('lista');
  const [selectedTask, setSelectedTask] = useState(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Assessment
  const { data: assessment } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId),
    queryFn: () => base44.entities.Assessment.get(assessmentId),
    enabled: !!assessmentId,
  });

  // Action Plan
  const { data: plans = [], isLoading: loadingPlan } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId, 'action-plan'),
    queryFn: () => base44.entities.ActionPlan.filter({ assessment_id: assessmentId, tenant_id: tenantId }, '-generated_at', 1),
    enabled: !!assessmentId && !!tenantId,
  });
  const plan = plans[0] || null;
  const planId = plan?.id || null;

  // Tasks
  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId, 'action-tasks', planId),
    queryFn: () => base44.entities.ActionTask.filter({ plan_id: planId, tenant_id: tenantId }, '-priority_score', 500),
    enabled: !!planId && !!tenantId,
  });

  // Reviews
  const { data: reviews = [] } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId, 'action-plan-reviews', planId),
    queryFn: () => base44.entities.ActionPlanReview.filter({ action_plan_id: planId, tenant_id: tenantId }, '-review_date', 50),
    enabled: !!planId && !!tenantId,
  });

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    await base44.functions.invoke('generateActionPlan', { assessmentId, cycleId: null });
    qc.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId, 'action-plan') });
    qc.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId, 'action-tasks', planId) });
    setIsRegenerating(false);
  };

  const invalidateTasks = () => qc.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId, 'action-tasks', planId) });
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId, 'action-tasks', planId) });
    qc.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId, 'action-plan-reviews', planId) });
  };

  // Count pendencias for badge
  const activeTasks = tasks.filter(t => t.status !== 'cancelled' && t.status !== 'done');
  const pendenciasCount = activeTasks.filter(t => {
    return !t.assigned_to && !t.owner_name ||
      !t.due_date ||
      !t.expected_evidence ||
      (t.status === 'blocked' && !t.blocked_reason) ||
      (t.progress_percentage >= 100 && t.status !== 'done');
  }).length;

  if (loadingPlan) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando central do plano...
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-slate-400 gap-4">
        <LayoutDashboard className="w-12 h-12 opacity-30" />
        <p className="text-sm font-semibold">Nenhum plano de ação encontrado para este diagnóstico.</p>
        <p className="text-xs">Execute o motor de diagnóstico completo e gere o plano.</p>
        <PermissionGuard requireWrite fallback={null}>
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isRegenerating ? 'Gerando...' : 'Gerar Plano de Ação'}
          </button>
        </PermissionGuard>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">

      {/* Review Mode Banner */}
      {isReviewMode && (
        <ReviewModeBanner assessment_id={assessmentId} plan_id={planId} />
      )}

      {/* Fixed Header */}
      <APlanHeader
        assessment={assessment}
        plan={plan}
        tasks={tasks}
        reviews={reviews}
        onAddTask={canWrite ? () => setShowAddTask(true) : undefined}
        onRegenerate={canWrite ? handleRegenerate : undefined}
        isRegenerating={isRegenerating}
      />

      {/* Tab Navigation */}
      <div className="bg-white border-b border-slate-200 px-6 overflow-x-auto flex-shrink-0">
        <div className="flex gap-0 min-w-max">
          {TABS.map(tab => {
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

      {/* Content area — scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">

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
            <RecommendationsTab
              planId={planId}
              assessmentId={assessmentId}
              tenantId={tenantId}
              tasks={tasks}
              readOnly={!canWrite}
            />
          )}

          {activeTab === 'kanban' && (
            <KanbanTab tasks={tasks} planId={planId} assessmentId={assessmentId} onOpenTask={setSelectedTask} readOnly={!canWrite} />
          )}

          {activeTab === 'lista' && (
            <ListaExecutivaTab
              tasks={tasks}
              onOpenTask={setSelectedTask}
              planId={planId}
              tenantId={tenantId}
            />
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
            <ActionPlanReviewTimeline planId={planId} tenantId={tenantId} readOnly={!canWrite} />
          )}

          {activeTab === 'pendencias' && (
            <PendenciasTab tasks={tasks} onOpenTask={setSelectedTask} />
          )}

        </div>
      </div>

      {/* Task Full Drawer */}
      {selectedTask && (
        <TaskFullDrawer
          task={selectedTask}
          allTasks={tasks}
          planId={planId}
          tenantId={tenantId}
          readOnly={!canWrite}
          onClose={() => setSelectedTask(null)}
          onSaved={() => {
            invalidateTasks();
            setSelectedTask(null);
          }}
        />
      )}

      {/* Add Task Modal — write-guarded */}
      {showAddTask && (
        <PermissionGuard requireWrite fallback={null}>
          <AddManualTaskModal
            planId={planId}
            assessmentId={assessmentId}
            tenantId={tenantId}
            onClose={() => setShowAddTask(false)}
            onCreated={() => { invalidateTasks(); setShowAddTask(false); }}
          />
        </PermissionGuard>
      )}


    </div>
  );
}

export default function ActionPlanManagementPage() {
  const params = useParams();
  const { review_id: reviewId } = params;
  const { assessment_id: assessmentId } = params;
  
  return (
    <ReviewModeProvider assessment_id={assessmentId} review_id={reviewId}>
      <ActionPlanManagementPageInner />
    </ReviewModeProvider>
  );
}