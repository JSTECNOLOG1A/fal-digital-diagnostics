import React from 'react';
import { format, isBefore, addDays } from 'date-fns';
import { AlertTriangle, Clock, Calendar, CheckCircle2, HelpCircle } from 'lucide-react';
import { PRIORITY_STYLE, DIM_LABELS, STATUS_STYLE } from '../APlanConstants';

/**
 * @param {Object} props
 * @param {any=} props.task
 * @param {any=} props.onOpenTask
 * @param {any=} props.variant
 */
function TaskRow({ task, onOpenTask, variant }) {
  const p = PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.medium;
  const s = STATUS_STYLE[task.status] || STATUS_STYLE.todo;
  const today = new Date();
  const daysLeft = task.due_date
    ? Math.round((new Date(task.due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-50 last:border-0"
      onClick={() => onOpenTask(task)}
    >
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.dot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
          <span>{DIM_LABELS[task.dimension_key] || task.dimension_key || '—'}</span>
          {task.owner_name && <span>· {task.owner_name}</span>}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
        {task.progress_percentage > 0 && task.status !== 'done' && (
          <span className="text-[10px] text-slate-400">{task.progress_percentage}%</span>
        )}
        {task.due_date && (
          <span className={`text-[10px] font-semibold flex-shrink-0 ${
            variant === 'overdue' ? 'text-red-600' :
            daysLeft !== null && daysLeft <= 7 ? 'text-amber-600' :
            'text-slate-500'
          }`}>
            {format(new Date(String(task.due_date).slice(0, 10) + 'T12:00'), 'dd/MM/yyyy')}
            {variant === 'overdue' && ` (${Math.abs(daysLeft)}d atrás)`}
            {variant !== 'overdue' && daysLeft !== null && daysLeft <= 7 && ` (${daysLeft}d)`}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.title
 * @param {any=} props.icon
 * @param {any=} props.iconCls
 * @param {any=} props.accentCls
 * @param {any=} props.children
 * @param {any=} props.count
 */
function Section({ title, icon: SectionIcon, iconCls, accentCls, children, count }) {
  return (
    <div className="rounded-xl border overflow-hidden bg-white">
      <div className={`flex items-center gap-2 px-4 py-3 border-b ${accentCls}`}>
        <SectionIcon className={`w-4 h-4 ${iconCls}`} />
        <span className="text-sm font-bold text-slate-700">{title}</span>
        <span className="ml-auto text-xs font-semibold text-slate-500">{count}</span>
      </div>
      <div>
        {children}
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.tasks
 * @param {any=} props.onOpenTask
 */
export default function CronogramaTab({ tasks, onOpenTask }) {
  const today = new Date();
  const active = tasks.filter(t => t.status !== 'cancelled' && t.status !== 'done');

  const overdue = active.filter(t => t.due_date && isBefore(new Date(t.due_date), today))
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  const next7 = active.filter(t => {
    if (!t.due_date) return false;
    const d = new Date(t.due_date);
    return !isBefore(d, today) && isBefore(d, addDays(today, 8));
  }).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  const next30 = active.filter(t => {
    if (!t.due_date) return false;
    const d = new Date(t.due_date);
    return !isBefore(d, addDays(today, 8)) && isBefore(d, addDays(today, 31));
  }).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  const later = active.filter(t => {
    if (!t.due_date) return false;
    return !isBefore(new Date(t.due_date), addDays(today, 31));
  }).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  const noDueDate = active.filter(t => !t.due_date);

  const done = tasks.filter(t => t.status === 'done')
    .sort((a, b) => new Date(b.completed_at || b.updated_date).getTime() - new Date(a.completed_at || a.updated_date).getTime())
    .slice(0, 10);

  return (
    <div className="space-y-4">
      {overdue.length > 0 && (
        <Section title={`Vencidas`} icon={AlertTriangle} iconCls="text-red-500" accentCls="bg-red-50 border-red-200" count={`${overdue.length} tarefa${overdue.length !== 1 ? 's' : ''}`}>
          {overdue.map(t => <TaskRow key={t.id} task={t} onOpenTask={onOpenTask} variant="overdue" />)}
        </Section>
      )}

      {next7.length > 0 && (
        <Section title="Vencem nos próximos 7 dias" icon={AlertTriangle} iconCls="text-amber-500" accentCls="bg-amber-50 border-amber-200" count={`${next7.length} tarefa${next7.length !== 1 ? 's' : ''}`}>
          {next7.map(t => <TaskRow key={t.id} task={t} onOpenTask={onOpenTask} />)}
        </Section>
      )}

      <Section title="Próximos 30 dias" icon={Clock} iconCls="text-blue-500" accentCls="bg-blue-50 border-blue-200" count={`${next30.length} tarefa${next30.length !== 1 ? 's' : ''}`}>
        {next30.length === 0
          ? <p className="text-xs text-slate-400 px-4 py-3">Nenhuma tarefa com prazo nos próximos 30 dias.</p>
          : next30.map(t => <TaskRow key={t.id} task={t} onOpenTask={onOpenTask} />)
        }
      </Section>

      {later.length > 0 && (
        <Section title="Longo prazo" icon={Calendar} iconCls="text-slate-400" accentCls="bg-slate-50 border-slate-200" count={`${later.length} tarefa${later.length !== 1 ? 's' : ''}`}>
          {later.map(t => <TaskRow key={t.id} task={t} onOpenTask={onOpenTask} />)}
        </Section>
      )}

      {noDueDate.length > 0 && (
        <Section title="Sem prazo definido" icon={HelpCircle} iconCls="text-slate-400" accentCls="bg-slate-50 border-slate-200" count={`${noDueDate.length} tarefa${noDueDate.length !== 1 ? 's' : ''}`}>
          {noDueDate.map(t => <TaskRow key={t.id} task={t} onOpenTask={onOpenTask} />)}
        </Section>
      )}

      {done.length > 0 && (
        <Section title="Recentemente concluídas" icon={CheckCircle2} iconCls="text-emerald-500" accentCls="bg-emerald-50 border-emerald-200" count={`${done.length}`}>
          {done.map(t => <TaskRow key={t.id} task={t} onOpenTask={onOpenTask} variant="done" />)}
        </Section>
      )}
    </div>
  );
}