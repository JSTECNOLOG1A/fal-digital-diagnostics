import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { base44 } from '@/api/base44Client';
import { PRIORITY_STYLE, DIM_LABELS } from './APlanConstants';
import { Calendar, Lock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useReviewMode } from '@/context/ReviewModeContext';
import ReviewModeOverlay from './ReviewModeOverlay';
import { assessmentKey } from '@/lib/query-client';
import { useTenant } from '@/components/shared/TenantContext';
import { useToast } from '@/components/ui/use-toast';

const COLUMNS = [
  { key: 'todo',        label: 'A Estruturar', cls: 'bg-slate-50 border-slate-200',     hdr: 'bg-slate-100',     dot: 'bg-slate-400' },
  { key: 'in_progress', label: 'Em Andamento', cls: 'bg-blue-50 border-blue-200',       hdr: 'bg-blue-100',      dot: 'bg-blue-500' },
  { key: 'blocked',     label: 'Bloqueada',    cls: 'bg-amber-50 border-amber-200',     hdr: 'bg-amber-100',     dot: 'bg-amber-500' },
  { key: 'done',        label: 'Concluída',    cls: 'bg-emerald-50 border-emerald-200', hdr: 'bg-emerald-100',   dot: 'bg-emerald-500' },
  { key: 'cancelled',   label: 'Cancelada',    cls: 'bg-slate-50 border-slate-100',     hdr: 'bg-slate-100',     dot: 'bg-slate-300' },
];

/**
 * @param {Object} props
 * @param {any=} props.tasks
 * @param {any=} props.planId
 * @param {any=} props.onOpenTask
 * @param {any=} props.assessmentId
 * @param {boolean=} props.readOnly
 */
export default function KanbanTab({ tasks, planId, assessmentId, onOpenTask, readOnly = false }) {
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const { isReviewMode, review_id } = useReviewMode();
  const { toast } = useToast();
  const [activeTask, setActiveTask] = useState(null);

  // PointerSensor cobre mouse E toque em navegadores modernos — arrastar um
  // card pra qualquer coluna funciona igual no desktop e no celular, sem
  // precisar de um gesto de swipe separado (a versão anterior só permitia
  // mover pra coluna adjacente no toque; arrastar já cobre isso e mais).
  // activationConstraint com distância mínima evita que um toque/clique
  // simples (abrir o card) seja interpretado como início de arrasto.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  const handleStatusChange = async (taskId, newStatus) => {
    if (readOnly) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;

    const updates = { status: newStatus };
    if (newStatus === 'done') {
      const evidence = window.prompt('Evidência entregue (obrigatório para concluir):', task.completion_evidence || '');
      if (!evidence || !evidence.trim()) return;
      updates.progress_percentage = 100;
      updates.completion_evidence = evidence.trim();
    }
    if (newStatus === 'blocked') {
      const reason = window.prompt('Motivo do bloqueio (obrigatório):', task.blocked_reason || '');
      if (!reason || !reason.trim()) return;
      updates.blocked_reason = reason.trim();
    }

    const queryKey = assessmentKey(tenantId, assessmentId, 'action-tasks', planId);
    const previousTasks = qc.getQueryData(queryKey);

    // Optimistic update — atualiza o cache imediatamente para a Lista Executiva refletir sem delay
    qc.setQueryData(queryKey, (/** @type {any} */ prev) =>
      prev ? prev.map(t => t.id === taskId ? { ...t, ...updates } : t) : prev
    );

    try {
      const res = await base44.functions.invoke('updateActionTaskWithHistory', {
        task_id: taskId,
        updates,
        source: 'kanban',
        review_id: isReviewMode ? review_id : undefined,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      // Grava a tarefa (e o plano recalculado) que a própria resposta já
      // trouxe, em vez de invalidar e refazer o fetch de TODAS as tarefas
      // do plano — o update otimista acima já deixou a coluna certa na
      // tela, isso só reconcilia com o valor real do servidor.
      const updatedTask = res?.data?.task;
      if (updatedTask) {
        qc.setQueryData(queryKey, (/** @type {any} */ prev) =>
          prev ? prev.map(t => t.id === taskId ? { ...t, ...updatedTask } : t) : prev
        );
      }
      const updatedPlan = res?.data?.plan;
      if (updatedPlan) {
        qc.setQueryData(assessmentKey(tenantId, assessmentId, 'action-plan'), (/** @type {any} */ prev) =>
          prev ? prev.map(p => p.id === updatedPlan.id ? { ...p, ...updatedPlan } : p) : prev
        );
      }
    } catch (e) {
      qc.setQueryData(queryKey, previousTasks);
      toast({ title: 'Não foi possível mover a tarefa', description: e.message, variant: 'destructive' });
    }
  };

  const tasksByStatus = useMemo(() => {
    const grouped = {};
    COLUMNS.forEach(c => { grouped[c.key] = tasks.filter(t => t.status === c.key); });
    return grouped;
  }, [tasks]);

  const handleDragStart = (event) => {
    const task = tasks.find(t => t.id === event.active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = (event) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const newStatus = String(over.id);
    handleStatusChange(active.id, newStatus);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveTask(null)}>
      <div className="relative flex gap-3 w-full">
        {isReviewMode && <ReviewModeOverlay />}
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.key}
            col={col}
            tasks={tasksByStatus[col.key] || []}
            onOpenTask={onOpenTask}
            readOnly={readOnly}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.22,1,0.36,1)' }}>
        {activeTask ? <KanbanCardContent task={activeTask} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

/* ── Droppable Column ── */
/**
 * @param {Object} props
 * @param {any=} props.col
 * @param {any=} props.tasks
 * @param {any=} props.onOpenTask
 * @param {boolean=} props.readOnly
 */
function KanbanColumn({ col, tasks, onOpenTask, readOnly = false }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key, disabled: readOnly });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-0 rounded-xl border-2 transition-colors duration-150 ${
        isOver ? 'border-blue-400 bg-blue-50/60' : col.cls
      }`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl border-b ${col.hdr}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${col.dot}`} />
          <span className="text-xs font-bold text-slate-700">{col.label}</span>
        </div>
        <span className="text-[10px] bg-white rounded-full px-2 py-0.5 font-bold text-slate-500 shadow-sm">{tasks.length}</span>
      </div>

      {/* Cards */}
      <div className={`p-2 space-y-2 min-h-[400px] transition-colors ${isOver ? 'bg-blue-50/30' : ''}`}>
        {tasks.map(task => (
          <KanbanCard
            key={task.id}
            task={task}
            onOpenTask={onOpenTask}
            readOnly={readOnly}
          />
        ))}
        {tasks.length === 0 && !isOver && (
          <div className="flex items-center justify-center h-24 text-[10px] text-slate-300 italic">
            Arraste tarefas aqui
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Draggable Card ── */
/**
 * @param {Object} props
 * @param {any=} props.task
 * @param {any=} props.onOpenTask
 * @param {boolean=} props.readOnly
 */
function KanbanCard({ task, onOpenTask, readOnly = false }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, disabled: readOnly });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    zIndex: 10,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => { if (!isDragging) onOpenTask(task); }}
      className={isDragging ? 'opacity-30 touch-none' : 'touch-none'}
    >
      <KanbanCardContent task={task} />
    </div>
  );
}

/* ── Pure card visual (reused by KanbanCard and DragOverlay) ── */
/**
 * @param {Object} props
 * @param {any} props.task
 * @param {boolean=} props.dragging
 */
function KanbanCardContent({ task, dragging = false }) {
  const p = PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.medium;
  const today = new Date();
  const isOverdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < today;
  const isDone = task.status === 'done';

  return (
    <div
      className={`rounded-xl border select-none bg-white group ${dragging ? 'cursor-grabbing shadow-xl' : 'cursor-grab hover:shadow-md transition-shadow'} ${
        task.is_blocked ? 'border-amber-300' :
        isOverdue       ? 'border-red-300' :
                          'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Priority strip */}
      <div className={`h-1 w-full rounded-t-xl ${p.dot}`} />
      <div className="px-3 pb-3 pt-2.5 space-y-2">
        {/* Title + flags */}
        <div className="flex items-start gap-2">
          <p className={`text-xs font-semibold leading-snug flex-1 ${isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>
            {task.title}
          </p>
          {task.is_blocked && <Lock className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />}
          {isOverdue        && <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />}
        </div>

        {/* Dimension badge */}
        {task.dimension_key && (
          <span className="inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
            {DIM_LABELS[task.dimension_key] || task.dimension_key}
          </span>
        )}

        {/* Progress */}
        {task.progress_percentage > 0 && !isDone && (
          <div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${task.progress_percentage}%` }} />
            </div>
            <p className="text-[9px] text-slate-400 mt-0.5">{task.progress_percentage}% completo</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-0.5">
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${p.badge}`}>{p.label}</span>
          <div className="flex items-center gap-2 text-[10px]">
            {task.owner_name && (
              <span className="flex items-center gap-0.5 text-slate-500 truncate max-w-[60px]">
                <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-600 flex-shrink-0">
                  {task.owner_name.charAt(0).toUpperCase()}
                </span>
                {task.owner_name.split(' ')[0]}
              </span>
            )}
            {task.due_date && (
              <span className={`flex items-center gap-0.5 font-medium ${isOverdue ? 'text-red-600' : 'text-slate-400'}`}>
                <Calendar className="w-2.5 h-2.5" />
                {format(new Date(String(task.due_date).slice(0, 10) + 'T12:00'), 'dd/MM')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
