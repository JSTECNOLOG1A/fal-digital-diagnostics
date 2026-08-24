import React from 'react';
import { AlertTriangle, Clock, Lock, Lightbulb, Calendar, TrendingUp } from 'lucide-react';
import { format, isAfter } from 'date-fns';

/**
 * @param {Object} props
 * @param {any=} props.tasks
 * @param {any=} props.recommendations
 * @param {any=} props.reviews
 */
export default function APlanExecutiveHeader({ tasks, recommendations, reviews }) {
  const active = tasks.filter(t => t.status !== 'cancelled');
  const done = active.filter(t => t.status === 'done').length;
  const critical = active.filter(t => t.priority === 'critical' && t.status !== 'done').length;
  const blocked = active.filter(t => t.is_blocked || t.status === 'blocked').length;
  const today = new Date();
  const overdue = active.filter(t => t.due_date && t.status !== 'done' && isAfter(today, new Date(t.due_date))).length;
  const pendingRecs = (recommendations || []).filter(r => ['suggested', 'needs_classification'].includes(r.status)).length;
  const pct = active.length ? Math.round((done / active.length) * 100) : 0;
  const lastReview = reviews?.filter(r => r.status === 'completed').at(-1);

  const stats = [
    { label: 'Progresso', value: `${pct}%`, sub: `${done}/${active.length} tarefas`, icon: TrendingUp, cls: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Críticas', value: critical, sub: 'abertas', icon: AlertTriangle, cls: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Atrasadas', value: overdue, sub: 'tarefas', icon: Clock, cls: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Bloqueadas', value: blocked, sub: 'tarefas', icon: Lock, cls: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Sugestões', value: pendingRecs, sub: 'pendentes', icon: Lightbulb, cls: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Última revisão', value: lastReview ? format(new Date(lastReview.review_date + 'T12:00'), 'dd/MM') : '—', sub: lastReview ? `Rev. Nº${lastReview.review_number}` : 'Nenhuma', icon: Calendar, cls: 'text-slate-600', bg: 'bg-slate-50' },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      {/* Progress bar */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-600">Progresso geral do plano</span>
        <span className="text-sm font-bold text-slate-800">{pct}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-5">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: pct >= 80 ? '#22c55e' : pct >= 40 ? '#3b82f6' : '#f59e0b' }}
        />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map(s => (
          <div key={s.label} className={`rounded-xl p-3 ${s.bg} flex flex-col gap-1`}>
            <s.icon className={`w-4 h-4 ${s.cls}`} />
            <p className={`text-xl font-black ${s.cls}`}>{s.value}</p>
            <p className="text-[10px] font-semibold text-slate-500">{s.label}</p>
            <p className="text-[9px] text-slate-400">{s.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}