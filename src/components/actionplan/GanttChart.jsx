/**
 * GanttChart — Visualização de Gantt por data real com milestones e marcos.
 * Referências: Asana, Monday.com, ClickUp
 */
import React, { useMemo, useState } from 'react';
import { addDays, differenceInDays, format, startOfDay, isToday, isBefore, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PRIORITY_STYLE, DIM_LABELS, STATUS_STYLE } from './APlanConstants';
import { Flag, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

const HORIZON_DAYS = { '30d': 30, '60d': 60, '90d': 90, '180d': 180 };
const HORIZON_COLOR = {
  '30d': { bar: '#ef4444', bg: 'bg-red-500', light: 'bg-red-100' },
  '60d': { bar: '#f59e0b', bg: 'bg-amber-500', light: 'bg-amber-100' },
  '90d': { bar: '#3b82f6', bg: 'bg-blue-500', light: 'bg-blue-100' },
  '180d': { bar: '#8b5cf6', bg: 'bg-violet-500', light: 'bg-violet-100' },
};
const PRIORITY_BAR = { critical: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#94a3b8' };
const STATUS_OPACITY = { todo: 0.7, in_progress: 1, blocked: 0.8, done: 0.4, cancelled: 0.2 };

const CELL_WIDTH = 28; // pixels per day
const ROW_HEIGHT = 40;
const LABEL_WIDTH = 220;

/**
 * @param {Object} props
 * @param {any=} props.tasks
 * @param {any=} props.reviews
 * @param {any=} props.onOpenTask
 */
export default function GanttChart({ tasks, reviews = [], onOpenTask }) {
  const today = startOfDay(new Date());
  const [viewStart, setViewStart] = useState(() => addDays(today, -7));
  const [viewDays, setViewDays] = useState(90);

  const viewEnd = addDays(viewStart, viewDays);

  // Tarefas com datas calculadas
  const rows = useMemo(() => {
    return tasks
      .filter(t => t.status !== 'cancelled')
      .map(t => {
        const horizonDays = HORIZON_DAYS[t.horizon] || 90;
        const taskStart = t.start_date ? parseISO(t.start_date) : today;
        const taskEnd = t.due_date
          ? parseISO(t.due_date)
          : addDays(taskStart, horizonDays);
        return { ...t, _start: taskStart, _end: taskEnd };
      })
      .sort((a, b) => a._start - b._start);
  }, [tasks, today]);

  // Milestones = tarefas marcadas como milestone (priority critical + horizon 30d) ou revisões
  const milestones = useMemo(() => {
    const taskMilestones = rows
      .filter(t => t.priority === 'critical' && t.task_layer !== 'operational')
      .map(t => ({ id: t.id, date: t._end, label: t.title, type: 'task', status: t.status }));

    const reviewMilestones = reviews
      .filter(r => r.review_date)
      .map(r => ({
        id: r.id,
        date: parseISO(r.review_date + 'T12:00'),
        label: `Revisão #${r.review_number}`,
        type: r.status === 'completed' ? 'review_done' : 'review',
        status: r.status,
      }));

    return [...taskMilestones, ...reviewMilestones].sort((a, b) => a.date - b.date);
  }, [rows, reviews]);

  // Gerar colunas de datas
  const dateColumns = useMemo(() => {
    const cols = [];
    for (let i = 0; i < viewDays; i++) {
      cols.push(addDays(viewStart, i));
    }
    return cols;
  }, [viewStart, viewDays]);

  // Semanas para o header
  const weekHeaders = useMemo(() => {
    const weeks = [];
    let cursor = startOfDay(viewStart);
    while (cursor < viewEnd) {
      const weekEnd = addDays(cursor, 7);
      weeks.push({ start: cursor, end: weekEnd < viewEnd ? weekEnd : viewEnd });
      cursor = weekEnd;
    }
    return weeks;
  }, [viewStart, viewEnd]);

  const getX = (date) => Math.max(0, differenceInDays(date, viewStart)) * CELL_WIDTH;
  const getWidth = (start, end) => {
    const s = start < viewStart ? viewStart : start;
    const e = end > viewEnd ? viewEnd : end;
    return Math.max(CELL_WIDTH, differenceInDays(e, s) * CELL_WIDTH);
  };

  const todayX = differenceInDays(today, viewStart) * CELL_WIDTH;
  const totalWidth = viewDays * CELL_WIDTH;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewStart(d => addDays(d, -30))}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <span className="text-sm font-semibold text-slate-700 min-w-[160px] text-center">
            {format(viewStart, 'dd MMM', { locale: ptBR })} — {format(viewEnd, 'dd MMM yyyy', { locale: ptBR })}
          </span>
          <button
            onClick={() => setViewStart(d => addDays(d, 30))}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>
        <div className="flex items-center gap-1 bg-white border rounded-lg p-1">
          {[
            { label: '1 mês', days: 30 },
            { label: '3 meses', days: 90 },
            { label: '6 meses', days: 180 },
          ].map(o => (
            <button
              key={o.days}
              onClick={() => setViewDays(o.days)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${viewDays === o.days ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Crítica</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Alta</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Média</span>
          <span className="flex items-center gap-1"><Flag className="w-3 h-3 text-indigo-500" /> Marco</span>
        </div>
      </div>

      {/* Gantt grid */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
          <div style={{ minWidth: LABEL_WIDTH + totalWidth + 2 }}>

            {/* Header: semanas */}
            <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
              <div style={{ width: LABEL_WIDTH, minWidth: LABEL_WIDTH }} className="flex-shrink-0 border-r border-slate-200 px-3 py-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Tarefa</span>
              </div>
              <div style={{ width: totalWidth }} className="relative flex-shrink-0">
                {/* Week headers */}
                <div className="flex">
                  {weekHeaders.map((w, i) => {
                    const wWidth = differenceInDays(w.end, w.start) * CELL_WIDTH;
                    return (
                      <div
                        key={i}
                        style={{ width: wWidth }}
                        className="flex-shrink-0 border-r border-slate-200 px-1 py-1.5"
                      >
                        <span className="text-[9px] font-semibold text-slate-500">
                          {format(w.start, 'dd MMM', { locale: ptBR })}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Day marks on second row */}
                <div className="flex border-t border-slate-100">
                  {dateColumns.map((d, i) => {
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    const isTodayDate = isToday(d);
                    return (
                      <div
                        key={i}
                        style={{ width: CELL_WIDTH }}
                        className={`flex-shrink-0 flex items-center justify-center text-[8px] font-medium py-0.5 border-r border-slate-100 ${isTodayDate ? 'bg-blue-100 text-blue-700 font-bold' : isWeekend ? 'bg-slate-100 text-slate-400' : 'text-slate-300'}`}
                      >
                        {d.getDate()}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Milestone row */}
            {milestones.length > 0 && (
              <div className="flex border-b border-indigo-100 bg-indigo-50/30">
                <div style={{ width: LABEL_WIDTH, minWidth: LABEL_WIDTH }} className="flex-shrink-0 border-r border-slate-200 px-3 py-2 flex items-center gap-2">
                  <Flag className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-[10px] font-bold text-indigo-600">Marcos</span>
                </div>
                <div style={{ width: totalWidth, height: ROW_HEIGHT }} className="relative flex-shrink-0">
                  {/* Weekend shading */}
                  {dateColumns.map((d, i) => {
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return isWeekend ? (
                      <div key={i} style={{ left: i * CELL_WIDTH, width: CELL_WIDTH, top: 0, bottom: 0, position: 'absolute' }} className="bg-slate-50/50" />
                    ) : null;
                  })}
                  {/* Today line */}
                  {todayX >= 0 && todayX <= totalWidth && (
                    <div style={{ left: todayX, top: 0, bottom: 0, position: 'absolute' }} className="w-0.5 bg-blue-400 z-10" />
                  )}
                  {milestones.map(m => {
                    const x = getX(m.date);
                    if (x < 0 || x > totalWidth) return null;
                    const isMileDone = m.status === 'done' || m.status === 'completed';
                    return (
                      <div
                        key={m.id}
                        style={{ left: x - 8, top: 8, position: 'absolute' }}
                        className="group cursor-pointer"
                        title={`${m.label} — ${format(m.date, 'dd/MM/yyyy')}`}
                      >
                        {m.type === 'task' ? (
                          <div
                            className={`w-4 h-4 rotate-45 border-2 ${isMileDone ? 'bg-emerald-400 border-emerald-500' : 'bg-indigo-500 border-indigo-600'}`}
                          />
                        ) : (
                          <div className={`w-4 h-4 rounded-full border-2 ${isMileDone ? 'bg-emerald-400 border-emerald-500' : 'bg-amber-400 border-amber-500'}`} />
                        )}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50 bg-slate-800 text-white text-[9px] px-2 py-1 rounded whitespace-nowrap">
                          {m.label}
                          <br />{format(m.date, 'dd/MM/yyyy')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Task rows */}
            {rows.map((task, idx) => {
              const barX = getX(task._start);
              const barW = getWidth(task._start, task._end);
              const barColor = PRIORITY_BAR[task.priority] || '#94a3b8';
              const opacity = STATUS_OPACITY[task.status] ?? 1;
              const isDone = task.status === 'done';
              const isOverdue = !isDone && isBefore(task._end, today);
              const p = PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.medium;

              return (
                <div
                  key={task.id}
                  className={`flex border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/20'}`}
                  style={{ height: ROW_HEIGHT }}
                >
                  {/* Label */}
                  <div
                    style={{ width: LABEL_WIDTH, minWidth: LABEL_WIDTH }}
                    className="flex-shrink-0 border-r border-slate-200 px-3 flex items-center gap-2 cursor-pointer"
                    onClick={() => onOpenTask && onOpenTask(task)}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.dot} ${isDone ? 'opacity-40' : ''}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate leading-tight ${isDone ? 'line-through text-slate-400' : isOverdue ? 'text-red-700' : 'text-slate-700'}`}>
                        {task.title}
                      </p>
                      <p className="text-[9px] text-slate-400 truncate">
                        {DIM_LABELS[task.dimension_key] || task.dimension_key || '—'}
                        {task.owner_name && ` · ${task.owner_name}`}
                      </p>
                    </div>
                    {isOverdue && <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />}
                  </div>

                  {/* Bar area */}
                  <div style={{ width: totalWidth, position: 'relative' }} className="flex-shrink-0 flex items-center">
                    {/* Weekend shading */}
                    {dateColumns.map((d, i) => {
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      return isWeekend ? (
                        <div key={i} style={{ left: i * CELL_WIDTH, width: CELL_WIDTH, top: 0, bottom: 0, position: 'absolute' }} className="bg-slate-100/40" />
                      ) : null;
                    })}

                    {/* Today line */}
                    {todayX >= 0 && todayX <= totalWidth && (
                      <div style={{ left: todayX, top: 0, bottom: 0, position: 'absolute' }} className="w-0.5 bg-blue-400 z-10 opacity-60" />
                    )}

                    {/* Task bar */}
                    {barX >= 0 && barX <= totalWidth && (
                      <div
                        style={{
                          left: barX,
                          width: Math.min(barW, totalWidth - barX),
                          position: 'absolute',
                          top: 8,
                          bottom: 8,
                          opacity,
                          cursor: 'pointer',
                        }}
                        className="rounded group"
                        onClick={() => onOpenTask && onOpenTask(task)}
                      >
                        <div
                          className="h-full rounded relative overflow-hidden flex items-center px-2"
                          style={{ backgroundColor: barColor + '33', border: `1.5px solid ${barColor}` }}
                        >
                          {/* Progress fill */}
                          {task.progress_percentage > 0 && (
                            <div
                              className="absolute inset-0 rounded"
                              style={{ width: `${task.progress_percentage}%`, backgroundColor: barColor + '55' }}
                            />
                          )}
                          {barW > 60 && (
                            <span className="text-[9px] font-semibold relative z-10 truncate" style={{ color: barColor }}>
                              {isDone ? '✓ ' : ''}{task.title}
                            </span>
                          )}
                        </div>
                        {/* Tooltip */}
                        <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-50 bg-slate-800 text-white text-[9px] px-2 py-1.5 rounded shadow-lg whitespace-nowrap">
                          <p className="font-semibold">{task.title}</p>
                          <p className="opacity-80">{format(task._start, 'dd/MM')} → {format(task._end, 'dd/MM/yyyy')}</p>
                          {task.owner_name && <p className="opacity-70">👤 {task.owner_name}</p>}
                          <p className="opacity-70">{STATUS_STYLE[task.status]?.label}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {rows.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm">
                Nenhuma tarefa para exibir no Gantt.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-slate-400 flex-wrap">
        <span className="flex items-center gap-1"><span className="inline-block w-6 h-3 rounded border-2 border-blue-400 bg-blue-100 opacity-60" /> Período da tarefa</span>
        <span className="flex items-center gap-1"><span className="inline-block w-0.5 h-3 bg-blue-400" /> Hoje</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 rotate-45 border-2 border-indigo-500 bg-indigo-500" style={{ display: 'inline-block', width: 10, height: 10 }} /> Marco crítico</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full border-2 border-amber-400 bg-amber-400" /> Revisão</span>
        <span className="opacity-70">Arraste horizontalmente para navegar</span>
      </div>
    </div>
  );
}