import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, ChevronDown, ChevronRight, Layers, Wrench, Lock, Calendar, CheckCircle2 } from 'lucide-react';
import { PRIORITY_STYLE, STATUS_STYLE, DIM_LABELS } from './APlanConstants';
import { format } from 'date-fns';

/**
 * @param {Object} props
 * @param {any=} props.tasks
 * @param {any=} props.recommendations
 * @param {any=} props.onOpenTask
 * @param {any=} props.onStatusChange
 * @param {any=} props.onAddTask
 * @param {any=} props.groupBy
 * @param {any=} props.setGroupBy
 * @param {boolean=} props.readOnly
 */
export default function TasksTab({ tasks, recommendations, onOpenTask, onStatusChange, onAddTask, groupBy, setGroupBy, readOnly = false }) {
  const [filterStatus, setFilterStatus] = useState('active');

  const visible = useMemo(() => tasks.filter(t => {
    if (filterStatus === 'active') return t.status !== 'done' && t.status !== 'cancelled';
    if (filterStatus === 'done') return t.status === 'done';
    if (filterStatus === 'blocked') return (t.is_blocked || t.status === 'blocked') && t.status !== 'done' && t.status !== 'cancelled';
    return t.status !== 'cancelled';
  }), [tasks, filterStatus]);

  const groups = useMemo(() => {
    if (groupBy === 'layer') {
      return [
        { key: 'strategic', title: 'Estratégicas', icon: Layers, color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200', tasks: visible.filter(t => t.task_layer !== 'operational') },
        { key: 'operational', title: 'Operacionais', icon: Wrench, color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200', tasks: visible.filter(t => t.task_layer === 'operational') },
      ];
    }
    if (groupBy === 'dimension') {
      const dims = [...new Set(visible.map(t => t.dimension_key || '__none'))];
      return dims.map(d => ({ key: d, title: DIM_LABELS[d] || (d === '__none' ? 'Sem dimensão' : d), tasks: visible.filter(t => (t.dimension_key || '__none') === d) }));
    }
    if (groupBy === 'priority') {
      return ['critical', 'high', 'medium', 'low'].map(p => ({ key: p, title: PRIORITY_STYLE[p]?.label || p, tasks: visible.filter(t => t.priority === p) }));
    }
    if (groupBy === 'horizon') {
      return ['30d', '60d', '90d', '180d'].map(h => ({ key: h, title: h, tasks: visible.filter(t => t.horizon === h) }));
    }
    return [];
  }, [visible, groupBy]);

  const recMap = useMemo(() => {
    const m = {};
    (recommendations || []).forEach(r => { if (r.id) m[r.id] = r; });
    return m;
  }, [recommendations]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-2">
          <FilterBar label="Status:" value={filterStatus} onChange={setFilterStatus} options={[
            ['active', 'Abertas'], ['blocked', 'Bloqueadas'], ['done', 'Concluídas'], ['all', 'Todas']
          ]} />
          <FilterBar label="Agrupar:" value={groupBy} onChange={setGroupBy} options={[
            ['layer', 'Camada'], ['dimension', 'Dimensão'], ['priority', 'Prioridade'], ['horizon', 'Horizonte']
          ]} />
        </div>
        {!readOnly && (
        <Button size="sm" variant="outline" onClick={onAddTask} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Nova tarefa
        </Button>
        )}
      </div>

      <div className="space-y-3">
        {groups.map(g => g.tasks.length > 0 && (
          <TaskGroup key={g.key} group={g} recMap={recMap} onOpenTask={onOpenTask} onStatusChange={onStatusChange} readOnly={readOnly} />
        ))}
        {visible.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma tarefa nesta visualização.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.group
 * @param {any=} props.recMap
 * @param {any=} props.onOpenTask
 * @param {any=} props.onStatusChange
 * @param {boolean=} props.readOnly
 */
function TaskGroup({ group, recMap, onOpenTask, onStatusChange, readOnly = false }) {
  const [open, setOpen] = useState(true);
  const done = group.tasks.filter(t => t.status === 'done').length;
  const pct = group.tasks.length ? Math.round((done / group.tasks.length) * 100) : 0;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 hover:opacity-90 text-left border-b ${group.bg || 'bg-slate-50 border-slate-200'}`}
      >
        <div className="flex items-center gap-2">
          {group.icon && <group.icon className={`w-4 h-4 ${group.color || 'text-slate-600'}`} />}
          <span className={`text-sm font-bold ${group.color || 'text-slate-700'}`}>{group.title}</span>
          <span className="text-[10px] text-slate-500 font-medium">{group.tasks.length} tarefa{group.tasks.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <div className="h-1.5 w-20 bg-white/60 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-slate-400 font-medium">{pct}%</span>
          </div>
          {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="divide-y divide-slate-50">
          {group.tasks.map(t => (
            <TaskRow key={t.id} task={t} rec={t.recommendation_id ? recMap[t.recommendation_id] : null} onOpenTask={onOpenTask} onStatusChange={onStatusChange} readOnly={readOnly} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.task
 * @param {any=} props.rec
 * @param {any=} props.onOpenTask
 * @param {any=} props.onStatusChange
 * @param {boolean=} props.readOnly
 */
function TaskRow({ task, rec, onOpenTask, onStatusChange, readOnly = false }) {
  const p = PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.medium;
  const s = STATUS_STYLE[task.status] || STATUS_STYLE.todo;
  const isDone = task.status === 'done';

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer group transition-colors"
      onClick={() => onOpenTask(task)}
    >
      <button
        onClick={e => { e.stopPropagation(); if (!readOnly) onStatusChange(task); }}
        disabled={isDone || task.status === 'cancelled' || readOnly}
        className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${isDone ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 hover:border-emerald-400'}`}
      >
        {isDone && <CheckCircle2 className="w-3 h-3 text-white" />}
      </button>

      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.dot} ${isDone ? 'opacity-30' : ''}`} />

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug truncate ${isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</p>
        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
          {task.dimension_key && <span>{DIM_LABELS[task.dimension_key] || task.dimension_key}</span>}
          {rec && <span className="text-violet-500">· via {rec.title?.slice(0, 25)}...</span>}
          {task.is_blocked && <span className="flex items-center gap-0.5 text-amber-500"><Lock className="w-2.5 h-2.5" /> Bloqueada</span>}
        </div>
      </div>

      <div className="hidden md:flex items-center gap-3 flex-shrink-0">
        {task.owner_name && <span className="text-xs text-slate-500 truncate max-w-[80px]">{task.owner_name}</span>}
        {task.due_date && (
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Calendar className="w-3 h-3" />{format(new Date(task.due_date), 'dd/MM/yy')}
          </span>
        )}
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
        {task.progress_percentage > 0 && !isDone && (
          <span className="text-[10px] text-slate-400">{task.progress_percentage}%</span>
        )}
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.label
 * @param {any=} props.value
 * @param {any=} props.onChange
 * @param {any=} props.options
 */
function FilterBar({ label, value, onChange, options }) {
  return (
    <div className="flex items-center gap-1 bg-white border rounded-lg p-1">
      <span className="text-[10px] text-slate-400 px-1">{label}</span>
      {options.map(([val, lbl]) => (
        <button key={val} onClick={() => onChange(val)}
          className={`px-2 py-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap ${value === val ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'}`}
        >{lbl}</button>
      ))}
    </div>
  );
}