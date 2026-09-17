import React from 'react';
import { format, isBefore, addDays } from 'date-fns';
import { Calendar, AlertTriangle, CheckCircle2, Clock, GitBranch } from 'lucide-react';
import { PRIORITY_STYLE, DIM_LABELS } from './APlanConstants';

/**
 * @param {Object} props
 * @param {any=} props.tasks
 * @param {any=} props.reviews
 */
export default function TimelineTab({ tasks, reviews }) {
  const today = new Date();
  const upcoming = tasks
    .filter(t => t.due_date && t.status !== 'done' && t.status !== 'cancelled')
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  const overdue = upcoming.filter(t => isBefore(new Date(t.due_date), today));
  const next30 = upcoming.filter(t => {
    const d = new Date(t.due_date);
    return !isBefore(d, today) && isBefore(d, addDays(today, 30));
  });
  const later = upcoming.filter(t => !isBefore(new Date(t.due_date), addDays(today, 30)));
  const done = tasks.filter(t => t.status === 'done' && t.completed_at)
    .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
    .slice(0, 5);
  const completedReviews = (reviews || []).filter(r => r.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Overdue */}
      {overdue.length > 0 && (
        <Section title={`Atrasadas (${overdue.length})`} icon={AlertTriangle} iconCls="text-red-500" accent="border-red-200 bg-red-50">
          {overdue.map(t => <TimelineRow key={t.id} task={t} overdue />)}
        </Section>
      )}

      {/* Next 30 days */}
      <Section title="Próximos 30 dias" icon={Clock} iconCls="text-amber-500" accent="border-amber-200 bg-amber-50">
        {next30.length === 0
          ? <p className="text-xs text-slate-400 px-3 py-2">Nenhuma tarefa com prazo nos próximos 30 dias.</p>
          : next30.map(t => <TimelineRow key={t.id} task={t} />)
        }
      </Section>

      {/* Revisões intermediárias */}
      {completedReviews.length > 0 && (
        <Section title="Histórico de Revisões" icon={GitBranch} iconCls="text-indigo-500" accent="border-indigo-200 bg-indigo-50">
          {completedReviews.slice(0, 5).map(r => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm border-b border-slate-100 last:border-0">
              <GitBranch className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-700">Revisão Nº {r.review_number} — {r.visit_type === 'final' ? 'Final' : 'Intermediária'}</p>
                {r.executive_summary && <p className="text-[10px] text-slate-400 line-clamp-1">{r.executive_summary}</p>}
              </div>
              <span className="text-[10px] text-slate-400">
                {r.review_date ? format(new Date(String(r.review_date).slice(0, 10) + 'T12:00'), 'dd/MM/yyyy') : '—'}
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* Longer horizon */}
      {later.length > 0 && (
        <Section title="Mais longo prazo" icon={Calendar} iconCls="text-slate-400" accent="border-slate-200 bg-slate-50">
          {later.map(t => <TimelineRow key={t.id} task={t} />)}
        </Section>
      )}

      {/* Recently done */}
      {done.length > 0 && (
        <Section title="Recentemente concluídas" icon={CheckCircle2} iconCls="text-emerald-500" accent="border-emerald-200 bg-emerald-50">
          {done.map(t => <TimelineRow key={t.id} task={t} completed />)}
        </Section>
      )}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.title
 * @param {any=} props.icon
 * @param {any=} props.iconCls
 * @param {any=} props.accent
 * @param {any=} props.children
 */
function Section({ title, icon: Icon, iconCls, accent, children }) {
  return (
    <div>
      <div className={`flex items-center gap-2 px-3 py-2 rounded-t-xl border ${accent}`}>
        <Icon className={`w-4 h-4 ${iconCls}`} />
        <span className="text-xs font-bold text-slate-700">{title}</span>
      </div>
      <div className="border border-t-0 border-slate-200 rounded-b-xl bg-white divide-y divide-slate-50">
        {children}
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.task
 * @param {any=} props.overdue
 * @param {any=} props.completed
 */
function TimelineRow({ task, overdue, completed }) {
  const p = PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.medium;
  const dateStr = completed && task.completed_at
    ? format(new Date(task.completed_at), 'dd/MM/yy')
    : task.due_date
    ? format(new Date(task.due_date), 'dd/MM/yy')
    : '—';

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${completed ? 'bg-emerald-500' : p.dot}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium truncate ${completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{task.title}</p>
        <p className="text-[10px] text-slate-400">{DIM_LABELS[task.dimension_key] || task.dimension_key || '—'}</p>
      </div>
      {task.owner_name && <span className="text-[10px] text-slate-400 hidden sm:block truncate max-w-[80px]">{task.owner_name}</span>}
      <span className={`text-[10px] font-semibold flex-shrink-0 ${overdue ? 'text-red-600' : completed ? 'text-emerald-600' : 'text-slate-500'}`}>{dateStr}</span>
      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${p.badge}`}>{p.label}</span>
    </div>
  );
}