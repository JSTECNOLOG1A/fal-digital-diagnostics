import React, { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { PRIORITY_STYLE, DIM_LABELS } from './APlanConstants';
import { Calendar, Lock, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useReviewMode } from '@/context/ReviewModeContext';
import ReviewModeOverlay from './ReviewModeOverlay';
import { assessmentKey } from '@/lib/query-client';
import { useTenant } from '@/components/shared/TenantContext';

const COLUMNS = [
  { key: 'todo',        label: 'A Estruturar', cls: 'bg-slate-50 border-slate-200',     hdr: 'bg-slate-100',     dot: 'bg-slate-400' },
  { key: 'in_progress', label: 'Em Andamento', cls: 'bg-blue-50 border-blue-200',       hdr: 'bg-blue-100',      dot: 'bg-blue-500' },
  { key: 'blocked',     label: 'Bloqueada',    cls: 'bg-amber-50 border-amber-200',     hdr: 'bg-amber-100',     dot: 'bg-amber-500' },
  { key: 'done',        label: 'Concluída',    cls: 'bg-emerald-50 border-emerald-200', hdr: 'bg-emerald-100',   dot: 'bg-emerald-500' },
  { key: 'cancelled',   label: 'Cancelada',    cls: 'bg-slate-50 border-slate-100',     hdr: 'bg-slate-100',     dot: 'bg-slate-300' },
];

const COL_KEYS = COLUMNS.map(c => c.key);

/**
 * @param {Object} props
 * @param {any=} props.tasks
 * @param {any=} props.planId
 * @param {any=} props.onOpenTask
 * @param {boolean=} props.readOnly
 */
export default function KanbanTab({ tasks, planId, onOpenTask, readOnly = false }) {
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const { isReviewMode, review_id } = useReviewMode();

  const handleStatusChange = async (taskId, newStatus) => {
    if (readOnly) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;
    const updates = { status: newStatus };
    if (newStatus === 'done') updates.progress_percentage = 100;

    // Optimistic update — atualiza o cache imediatamente para a Lista Executiva refletir sem delay
    qc.setQueryData(assessmentKey(tenantId, null, 'action-tasks', planId), (/** @type {any} */ prev) =>
      prev ? prev.map(t => t.id === taskId ? { ...t, ...updates } : t) : prev
    );

    await base44.functions.invoke('updateActionTaskWithHistory', {
      task_id: taskId, 
      updates, 
      source: 'kanban',
      review_id: isReviewMode ? review_id : undefined,
    });
    qc.invalidateQueries({ queryKey: assessmentKey(tenantId, null, 'action-tasks', planId) });
  };

  const tasksByStatus = {};
  COLUMNS.forEach(c => { tasksByStatus[c.key] = tasks.filter(t => t.status === c.key); });

  return (
    <div className="relative flex gap-3 w-full">
      {isReviewMode && <ReviewModeOverlay />}
      {COLUMNS.map(col => (
        <KanbanColumn
          key={col.key}
          col={col}
          tasks={tasksByStatus[col.key] || []}
          onDrop={handleStatusChange}
          onOpenTask={onOpenTask}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}

/* ── Droppable Column ── */
/**
 * @param {Object} props
 * @param {any=} props.col
 * @param {any=} props.tasks
 * @param {any=} props.onDrop
 * @param {any=} props.onOpenTask
 * @param {boolean=} props.readOnly
 */
function KanbanColumn({ col, tasks, onDrop, onOpenTask, readOnly = false }) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver  = (e) => { if (readOnly) return; e.preventDefault(); setDragOver(true); };
  const handleDragLeave = ()  => setDragOver(false);
  const handleDrop = (e) => {
    if (readOnly) return;
    e.preventDefault();
    setDragOver(false);
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) onDrop(taskId, col.key);
  };

  return (
    <div
      className={`flex-1 min-w-0 rounded-xl border-2 transition-all duration-200 ${
        dragOver ? 'border-blue-400 scale-[1.01] shadow-lg bg-blue-50/60' : col.cls
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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
      <div className={`p-2 space-y-2 min-h-[400px] transition-colors ${dragOver ? 'bg-blue-50/30' : ''}`}>
        {tasks.map(task => (
          <KanbanCard
            key={task.id}
            task={task}
            colKey={col.key}
            onOpenTask={onOpenTask}
            onStatusChange={onDrop}
            readOnly={readOnly}
          />
        ))}
        {tasks.length === 0 && !dragOver && (
          <div className="flex items-center justify-center h-24 text-[10px] text-slate-300 italic">
            Arraste tarefas aqui
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Draggable + Swipeable Card ── */
/**
 * @param {Object} props
 * @param {any=} props.task
 * @param {any=} props.colKey
 * @param {any=} props.onOpenTask
 * @param {any=} props.onStatusChange
 * @param {boolean=} props.readOnly
 */
function KanbanCard({ task, colKey, onOpenTask, onStatusChange, readOnly = false }) {
  const p = PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.medium;
  const today   = new Date();
  const isOverdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < today;
  const isDone    = task.status === 'done';

  // Touch swipe state
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeDir, setSwipeDir] = useState(null); // 'left' | 'right' | null
  const isSwiping = useRef(false);

  const currentColIdx = COL_KEYS.indexOf(colKey);

  const handleTouchStart = (e) => {
    if (readOnly) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = false;
  };

  const handleTouchMove = (e) => {
    if (!touchStartX.current) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    if (!isSwiping.current && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
      isSwiping.current = true;
    }
    if (!isSwiping.current) return;

    e.preventDefault();
    const clamped = Math.max(-120, Math.min(120, dx));
    setSwipeOffset(clamped);
    setSwipeDir(clamped > 0 ? 'right' : 'left');
  };

  const handleTouchEnd = () => {
    if (isSwiping.current && Math.abs(swipeOffset) > 60) {
      const nextIdx = swipeOffset > 0 ? currentColIdx - 1 : currentColIdx + 1;
      if (nextIdx >= 0 && nextIdx < COL_KEYS.length) {
        onStatusChange(task.id, COL_KEYS[nextIdx]);
      }
    }
    setSwipeOffset(0);
    setSwipeDir(null);
    isSwiping.current = false;
    touchStartX.current = null;
  };

  const prevCol = currentColIdx > 0 ? COLUMNS[currentColIdx - 1] : null;
  const nextCol = currentColIdx < COL_KEYS.length - 1 ? COLUMNS[currentColIdx + 1] : null;

  // Drag (desktop)
  const handleDragStart = (e) => {
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCardClick = (e) => {
    if (isSwiping.current) return;
    onOpenTask(task);
  };

  return (
    <div className="relative overflow-hidden rounded-xl select-none">
      {/* Swipe hint backgrounds */}
      {swipeDir === 'right' && prevCol && (
        <div className={`absolute inset-0 flex items-center px-3 rounded-xl ${prevCol.hdr} transition-opacity`}
          style={{ opacity: Math.min(1, Math.abs(swipeOffset) / 60) }}>
          <ChevronLeft className="w-4 h-4 text-slate-600" />
          <span className="text-[10px] font-semibold text-slate-600 ml-1">{prevCol.label}</span>
        </div>
      )}
      {swipeDir === 'left' && nextCol && (
        <div className={`absolute inset-0 flex items-center justify-end px-3 rounded-xl ${nextCol.hdr} transition-opacity`}
          style={{ opacity: Math.min(1, Math.abs(swipeOffset) / 60) }}>
          <span className="text-[10px] font-semibold text-slate-600 mr-1">{nextCol.label}</span>
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </div>
      )}

      {/* Card */}
      <div
        draggable={!readOnly}
        onDragStart={handleDragStart}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleCardClick}
        className={`rounded-xl border cursor-pointer hover:shadow-md transition-all bg-white group ${
          task.is_blocked ? 'border-amber-300' :
          isOverdue       ? 'border-red-300' :
                            'border-slate-200 hover:border-slate-300'
        }`}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: swipeOffset === 0 ? 'transform 0.25s cubic-bezier(0.22,1,0.36,1)' : 'none',
          willChange: 'transform',
        }}
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
                  {format(new Date(task.due_date), 'dd/MM')}
                </span>
              )}
            </div>
          </div>

          {/* Swipe nav hint (mobile) */}
          <div className="flex items-center justify-between text-[8px] text-slate-200 mt-0.5">
            {prevCol ? <span>← {prevCol.label}</span> : <span />}
            {nextCol ? <span>{nextCol.label} →</span> : <span />}
          </div>
        </div>
      </div>
    </div>
  );
}