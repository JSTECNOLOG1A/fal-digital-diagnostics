import React, { useState } from 'react';
import { assessmentKey, tenantKey } from '@/lib/query-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, LayoutDashboard, Lightbulb, CheckSquare, Columns, Clock, GitBranch, Loader2, Map, BarChart2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import APlanExecutiveHeader from '@/components/actionplan/APlanExecutiveHeader';
import RecommendationsTab from '@/components/actionplan/RecommendationsTab';
import TasksTab from '@/components/actionplan/TasksTab';
import KanbanTab from '@/components/actionplan/KanbanTab';
import TimelineTab from '@/components/actionplan/TimelineTab';
import GanttChart from '@/components/actionplan/GanttChart';
import RoadmapTab from '@/components/actionplan/RoadmapTab';
import AddManualTaskModal from '@/components/fal/AddManualTaskModal';
import TaskDrawer from '@/components/fal/TaskDrawer';
import ActionPlanReviewModal from '@/components/fal/ActionPlanReviewModal';
import ActionPlanReviewTimeline from '@/components/fal/ActionPlanReviewTimeline';
import { usePermissions } from '@/lib/hooks/usePermissions';

export default function ActionPlanPage() {
  const params = new URLSearchParams(window.location.search);
  const assessmentId = params.get('assessment_id');
  const planIdParam = params.get('plan_id');

  const { user, tenantId } = useTenant();
  const qc = useQueryClient();
  const { canWrite } = usePermissions();

  const [activeTab, setActiveTab] = useState('overview');
  const [selectedTask, setSelectedTask] = useState(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [groupBy, setGroupBy] = useState('layer');

  // Fetch action plan
  const { data: plans = [], isLoading: loadingPlan } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId, 'action-plan', planIdParam),
    queryFn: async () => {
      if (planIdParam) {
        const p = await base44.entities.ActionPlan.get(planIdParam);
        return [p];
      }
      if (assessmentId) {
        return base44.entities.ActionPlan.filter({ assessment_id: assessmentId, tenant_id: tenantId }, '-generated_at', 1);
      }
      return [];
    },
    enabled: !!(assessmentId || planIdParam) && !!tenantId,
  });

  const plan = plans[0] || null;
  const planId = plan?.id || planIdParam || null;

  // Fetch tasks
  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: tenantKey(tenantId, 'action-tasks', planId),
    queryFn: () => base44.entities.ActionTask.filter({ plan_id: planId, tenant_id: tenantId }, '-priority_score', 300),
    enabled: !!planId && !!tenantId,
  });

  // Fetch reviews
  const { data: reviews = [] } = useQuery({
    queryKey: tenantKey(tenantId, 'action-plan-reviews', planId),
    queryFn: () => base44.entities.ActionPlanReview.filter({ action_plan_id: planId, tenant_id: tenantId }, '-review_date', 50),
    enabled: !!planId && !!tenantId,
  });

  // Fetch recommendations
  const { data: recommendations = [] } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId, 'recommendations', planId),
    queryFn: async () => {
      const [byPlan, byAssessment] = await Promise.all([
        planId ? base44.entities.ActionRecommendation.filter({ action_plan_id: planId, tenant_id: tenantId }, '-created_date', 200) : Promise.resolve([]),
        assessmentId ? base44.entities.ActionRecommendation.filter({ assessment_id: assessmentId, tenant_id: tenantId }, '-created_date', 200) : Promise.resolve([]),
      ]);
      const map = new (/** @type {any} */ (Map))();
      [...byPlan, ...byAssessment].forEach(r => map.set(r.id, r));
      return [...map.values()].sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());
    },
    enabled: !!(planId || assessmentId) && !!tenantId,
  });

  const handleStatusChange = async (task) => {
    if (!canWrite) return;
    const nextStatus = task.status === 'todo' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'todo';
    const updates = { status: nextStatus };
    if (nextStatus === 'done') { updates.progress_percentage = 100; }
    await base44.functions.invoke('updateActionTaskWithHistory', {
      task_id: task.id,
      updates,
      source: 'direct_update',
    });
    qc.invalidateQueries({ queryKey: tenantKey(tenantId, 'action-tasks', planId) });
  };

  const loading = loadingPlan || loadingTasks;

  // Back link
  const backUrl = assessmentId ? createPageUrl(`AssessmentDetail?id=${assessmentId}`) : createPageUrl('Groups');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando plano de ação...
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-5">
      {/* Breadcrumb */}
      <Link to={backUrl} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="w-4 h-4" /> {assessmentId ? 'Diagnóstico' : 'Grupos'}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Plano de Ação Estratégico</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {plan ? `${tasks.length} tarefas · ${reviews.length} revisões` : 'Nenhum plano encontrado para este diagnóstico'}
          </p>
        </div>
        {planId && canWrite && (
          <button
            onClick={() => setShowReviewModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
          >
            <GitBranch className="w-4 h-4" /> Nova Revisão
          </button>
        )}
      </div>

      {!plan && !loading && (
        <div className="text-center py-20 text-slate-400">
          <LayoutDashboard className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-semibold">Nenhum plano de ação encontrado.</p>
          <p className="text-xs mt-1">Execute o diagnóstico completo para gerar o plano automaticamente.</p>
        </div>
      )}

      {plan && (
        <>
          {/* Executive header */}
          <APlanExecutiveHeader tasks={tasks} recommendations={recommendations} reviews={reviews} />

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-white border shadow-sm flex-wrap h-auto">
              <TabsTrigger value="overview" className="gap-1.5"><LayoutDashboard className="w-3.5 h-3.5" /> Visão Geral</TabsTrigger>
              <TabsTrigger value="roadmap" className="gap-1.5"><Map className="w-3.5 h-3.5" /> Roadmap</TabsTrigger>
              <TabsTrigger value="gantt" className="gap-1.5"><BarChart2 className="w-3.5 h-3.5" /> Gantt</TabsTrigger>
              <TabsTrigger value="recommendations" className="gap-1.5">
                <Lightbulb className="w-3.5 h-3.5" /> Recomendações
                {recommendations.filter(r => ['suggested', 'needs_classification'].includes(r.status)).length > 0 && (
                  <span className="ml-1 bg-amber-500 text-white text-[9px] rounded-full px-1.5 py-0.5 font-bold">
                    {recommendations.filter(r => ['suggested', 'needs_classification'].includes(r.status)).length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="tasks" className="gap-1.5"><CheckSquare className="w-3.5 h-3.5" /> Tarefas</TabsTrigger>
              <TabsTrigger value="kanban" className="gap-1.5"><Columns className="w-3.5 h-3.5" /> Kanban</TabsTrigger>
              <TabsTrigger value="timeline" className="gap-1.5"><Clock className="w-3.5 h-3.5" /> Timeline</TabsTrigger>
              <TabsTrigger value="reviews" className="gap-1.5"><GitBranch className="w-3.5 h-3.5" /> Revisões</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              {/* Quick summary by dimension */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {['todo', 'in_progress', 'blocked', 'done'].map(status => {
                  const count = tasks.filter(t => t.status === status).length;
                  const labels = { todo: 'A Fazer', in_progress: 'Em Andamento', blocked: 'Bloqueadas', done: 'Concluídas' };
                  const colors = { todo: 'text-slate-600 bg-slate-50 border-slate-200', in_progress: 'text-blue-600 bg-blue-50 border-blue-200', blocked: 'text-amber-600 bg-amber-50 border-amber-200', done: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
                  return (
                    <div key={status} className={`rounded-xl border p-4 ${colors[status]}`}>
                      <p className="text-2xl font-black">{count}</p>
                      <p className="text-xs font-semibold mt-1">{labels[status]}</p>
                    </div>
                  );
                })}
              </div>
              <ActionPlanReviewTimeline planId={planId} tenantId={tenantId} readOnly={!canWrite} />
            </TabsContent>

            <TabsContent value="roadmap" className="mt-4">
              <RoadmapTab tasks={tasks} reviews={reviews} onOpenTask={setSelectedTask} />
            </TabsContent>

            <TabsContent value="gantt" className="mt-4">
              <GanttChart tasks={tasks} reviews={reviews} onOpenTask={setSelectedTask} />
            </TabsContent>

            <TabsContent value="recommendations" className="mt-4">
              <RecommendationsTab
                planId={planId}
                assessmentId={assessmentId}
                tenantId={tenantId}
                tasks={tasks}
                readOnly={!canWrite}
              />
            </TabsContent>

            <TabsContent value="tasks" className="mt-4">
              <TasksTab
                tasks={tasks}
                recommendations={recommendations}
                onOpenTask={setSelectedTask}
                onStatusChange={handleStatusChange}
                onAddTask={canWrite ? () => setShowAddTask(true) : undefined}
                groupBy={groupBy}
                setGroupBy={setGroupBy}
                readOnly={!canWrite}
              />
            </TabsContent>

            <TabsContent value="kanban" className="mt-4">
              <KanbanTab tasks={tasks} planId={planId} onOpenTask={setSelectedTask} readOnly={!canWrite} />
            </TabsContent>

            <TabsContent value="timeline" className="mt-4">
              <TimelineTab tasks={tasks} reviews={reviews} />
            </TabsContent>

            <TabsContent value="reviews" className="mt-4">
              <ActionPlanReviewTimeline planId={planId} tenantId={tenantId} expanded readOnly={!canWrite} />
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Modals / Drawers */}
      {selectedTask && (
        <TaskDrawer
          task={selectedTask}
          planId={planId}
          tenantId={tenantId}
          readOnly={!canWrite}
          onClose={() => setSelectedTask(null)}
          onUpdated={() => {
            qc.invalidateQueries({ queryKey: tenantKey(tenantId, 'action-tasks', planId) });
            setSelectedTask(null);
          }}
        />
      )}

      {showAddTask && canWrite && (
        <AddManualTaskModal
          planId={planId}
          assessmentId={assessmentId}
          tenantId={tenantId}
          onClose={() => setShowAddTask(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: tenantKey(tenantId, 'action-tasks', planId) });
            setShowAddTask(false);
          }}
        />
      )}

      {showReviewModal && canWrite && (
        <ActionPlanReviewModal
          open={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          plan={plan}
          tasks={tasks}
          reviewNumber={(reviews?.length || 0) + 1}
          tenantId={tenantId}
          onReviewCompleted={() => {
            qc.invalidateQueries({ queryKey: tenantKey(tenantId, 'action-tasks', planId) });
            qc.invalidateQueries({ queryKey: tenantKey(tenantId, 'action-plan-reviews', planId) });
            setShowReviewModal(false);
          }}
        />
      )}
    </div>
  );
}