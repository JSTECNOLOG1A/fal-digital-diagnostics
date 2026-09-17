/**
 * RoadmapTab — Visão de roadmap por fase (horizonte), com milestones e marcos,
 * no estilo ProductBoard / Aha!
 */
import React, { useMemo } from 'react';
import { format, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Flag, CheckCircle2, AlertTriangle, GitBranch, ChevronRight } from 'lucide-react';
import { PRIORITY_STYLE, DIM_LABELS, STATUS_STYLE } from './APlanConstants';

const HORIZONS = [
  { key: '30d',  label: '30 dias',  color: 'border-red-300 bg-red-50',     hdr: 'bg-red-100 text-red-700',    dot: 'bg-red-500',    ring: 'ring-red-200' },
  { key: '60d',  label: '60 dias',  color: 'border-amber-300 bg-amber-50', hdr: 'bg-amber-100 text-amber-700',dot: 'bg-amber-500',  ring: 'ring-amber-200' },
  { key: '90d',  label: '90 dias',  color: 'border-blue-300 bg-blue-50',   hdr: 'bg-blue-100 text-blue-700',  dot: 'bg-blue-500',   ring: 'ring-blue-200' },
  { key: '180d', label: '180 dias', color: 'border-violet-300 bg-violet-50',hdr: 'bg-violet-100 text-violet-700',dot: 'bg-violet-500',ring: 'ring-violet-200' },
];

/**
 * @param {Object} props
 * @param {any=} props.tasks
 * @param {any=} props.reviews
 * @param {any=} props.onOpenTask
 */
export default function RoadmapTab({ tasks, reviews = [], onOpenTask }) {
  const today = new Date();

  const tasksByHorizon = useMemo(() => {
    const map = {};
    HORIZONS.forEach(h => { map[h.key] = []; });
    map['__none'] = [];
    tasks
      .filter(t => t.status !== 'cancelled')
      .forEach(t => {
        const h = t.horizon || '__none';
        if (map[h]) map[h].push(t);
        else map['__none'].push(t);
      });
    return map;
  }, [tasks]);

  const completedReviews = useMemo(() =>
    (reviews || []).filter(r => r.status === 'completed').sort((a, b) => new Date(a.review_date).getTime() - new Date(b.review_date).getTime()),
    [reviews]
  );

  const upcomingReviews = useMemo(() =>
    (reviews || []).filter(r => r.status !== 'completed' && r.review_date).sort((a, b) => new Date(a.review_date).getTime() - new Date(b.review_date).getTime()),
    [reviews]
  );

  return (
    <div className="space-y-6">
      {/* Revisões futuras como marcos no topo */}
      {upcomingReviews.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Flag className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-bold text-indigo-700">Próximas Revisões (Marcos)</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {upcomingReviews.map(r => {
              const daysUntil = Math.ceil((new Date(r.review_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div key={r.id} className="flex items-center gap-2 bg-white border border-indigo-200 rounded-lg px-3 py-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-white">R{r.review_number}</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Revisão #{r.review_number}</p>
                    <p className="text-[10px] text-slate-500">
                      {r.review_date ? format(new Date(String(r.review_date).slice(0, 10) + 'T12:00'), 'dd MMM yyyy', { locale: ptBR }) : '—'}
                      {daysUntil > 0 && <span className="ml-1 text-indigo-500 font-medium">· em {daysUntil}d</span>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Colunas por horizonte */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {HORIZONS.map(h => {
          const hTasks = tasksByHorizon[h.key] || [];
          const doneTasks = hTasks.filter(t => t.status === 'done');
          const overdueTasks = hTasks.filter(t => t.due_date && isBefore(new Date(t.due_date), today) && t.status !== 'done');
          const critTasks = hTasks.filter(t => t.priority === 'critical' && t.status !== 'done');
          const pct = hTasks.length ? Math.round((doneTasks.length / hTasks.length) * 100) : 0;

          return (
            <div key={h.key} className={`flex flex-col border-2 rounded-2xl overflow-hidden ${h.color}`}>
              {/* Column header */}
              <div className={`px-4 py-3 ${h.hdr}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${h.dot}`} />
                    <span className="text-sm font-bold">Fase {h.label}</span>
                  </div>
                  <span className="text-xs font-bold opacity-80">{hTasks.length} tarefas</span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-white transition-all" style={{ width: `${pct}%`, opacity: 0.9 }} />
                </div>
                <div className="flex justify-between mt-1 text-[10px] opacity-70">
                  <span>{doneTasks.length}/{hTasks.length} concluídas</span>
                  <span className="font-bold">{pct}%</span>
                </div>
              </div>

              {/* Alertas */}
              {(overdueTasks.length > 0 || critTasks.length > 0) && (
                <div className="px-3 pt-2 space-y-1">
                  {overdueTasks.length > 0 && (
                    <div className="flex items-center gap-1.5 bg-red-100 text-red-700 rounded-lg px-2 py-1.5 text-[10px] font-semibold">
                      <AlertTriangle className="w-3 h-3" />
                      {overdueTasks.length} tarefa{overdueTasks.length > 1 ? 's atrasadas' : ' atrasada'}
                    </div>
                  )}
                  {critTasks.length > 0 && (
                    <div className="flex items-center gap-1.5 bg-red-50 text-red-600 rounded-lg px-2 py-1.5 text-[10px] font-medium">
                      <Flag className="w-3 h-3" />
                      {critTasks.length} crítica{critTasks.length > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              )}

              {/* Task cards */}
              <div className="flex-1 p-3 space-y-2 overflow-y-auto max-h-[600px]">
                {hTasks.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs opacity-70">
                    Nenhuma tarefa nesta fase.
                  </div>
                ) : (
                  hTasks
                    .sort((a, b) => {
                      const order = { critical: 0, high: 1, medium: 2, low: 3 };
                      return (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
                    })
                    .map(task => (
                      <RoadmapCard key={task.id} task={task} today={today} onOpenTask={onOpenTask} />
                    ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Histórico de revisões */}
      {completedReviews.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <GitBranch className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-bold text-slate-700">Histórico de Revisões / Marcos Concluídos</span>
          </div>
          <div className="relative ml-4">
            {/* Timeline vertical line */}
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-200" />
            <div className="space-y-4 pl-6">
              {completedReviews.map((r, idx) => (
                <div key={r.id} className="relative">
                  {/* Circle */}
                  <div className="absolute -left-9 top-0 w-6 h-6 rounded-full bg-emerald-500 border-4 border-white shadow flex items-center justify-center">
                    <span className="text-[8px] font-black text-white">R{r.review_number}</span>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-emerald-800">
                        Revisão #{r.review_number} — {r.visit_type === 'final' ? 'Final' : r.visit_type === 'extraordinary' ? 'Extraordinária' : 'Intermediária'}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-medium">
                        {r.review_date ? format(new Date(String(r.review_date).slice(0, 10) + 'T12:00'), 'dd MMM yyyy', { locale: ptBR }) : '—'}
                      </span>
                    </div>
                    {r.executive_summary && (
                      <p className="text-[11px] text-slate-600 line-clamp-2">{r.executive_summary}</p>
                    )}
                    {(r.overall_progress_before != null || r.overall_progress_after != null) && (
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500">
                        <span>Progresso: </span>
                        <span className="font-medium text-slate-700">{r.overall_progress_before ?? '?'}%</span>
                        <ChevronRight className="w-3 h-3" />
                        <span className="font-bold text-emerald-700">{r.overall_progress_after ?? '?'}%</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.task
 * @param {any=} props.today
 * @param {any=} props.onOpenTask
 */
function RoadmapCard({ task, today, onOpenTask }) {
  const p = PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.medium;
  const s = STATUS_STYLE[task.status] || STATUS_STYLE.todo;
  const isDone = task.status === 'done';
  const isOverdue = !isDone && task.due_date && isBefore(new Date(task.due_date), today);
  const isCritical = task.priority === 'critical';

  return (
    <div
      onClick={() => onOpenTask && onOpenTask(task)}
      className={`bg-white rounded-xl border cursor-pointer hover:shadow-md transition-all group ${
        isDone ? 'border-emerald-200 opacity-60' :
        isOverdue ? 'border-red-300 shadow-sm' :
        isCritical ? `border-red-200 ${p.bg}` :
        'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-start gap-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${p.dot}`} />
          <p className={`text-xs font-semibold leading-snug flex-1 ${isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>
            {task.title}
          </p>
          {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
          {isOverdue && !isDone && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
        </div>

        {/* Dimension */}
        {task.dimension_key && (
          <p className="text-[10px] text-slate-400 truncate">
            {DIM_LABELS[task.dimension_key] || task.dimension_key}
          </p>
        )}

        {/* Metadata */}
        <div className="flex items-center justify-between flex-wrap gap-1">
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${p.badge}`}>{p.label}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
        </div>

        {/* Owner + due date */}
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          {task.owner_name
            ? <span className="truncate max-w-[100px]">👤 {task.owner_name}</span>
            : <span />
          }
          {task.due_date && (
            <span className={`font-medium ${isOverdue ? 'text-red-600' : 'text-slate-500'}`}>
              📅 {format(new Date(task.due_date), 'dd/MM/yy')}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {task.progress_percentage > 0 && !isDone && (
          <div>
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${task.progress_percentage}%` }} />
            </div>
            <p className="text-[9px] text-slate-400 mt-0.5">{task.progress_percentage}%</p>
          </div>
        )}
      </div>
    </div>
  );
}