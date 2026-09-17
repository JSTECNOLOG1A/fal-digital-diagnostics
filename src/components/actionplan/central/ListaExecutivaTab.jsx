import React, { useState, useMemo, useRef } from 'react';
import { format, isAfter } from 'date-fns';
import { AlertTriangle, Lock, Calendar, User, ChevronRight, CheckCircle2, Check, X, Edit2, GitBranch } from 'lucide-react';
import { PRIORITY_STYLE, DIM_LABELS, STATUS_STYLE } from '../APlanConstants';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useReviewMode } from '@/context/ReviewModeContext';
import { invalidateActionPlanQueries } from '@/lib/query-client';
import ReviewModeOverlay from '../ReviewModeOverlay';

const ORIGIN_SHORT = {
  cluster: 'Cluster', subdimension: 'Subdim.', dimension: 'Dimensão',
  killer_question: 'P. Crítica', question: 'Pergunta', manual: 'Manual',
};

const STATUS_OPTIONS = [
  { key: 'todo',        label: 'A Estruturar' },
  { key: 'in_progress', label: 'Em Andamento' },
  { key: 'blocked',     label: 'Bloqueada' },
  { key: 'done',        label: 'Concluída' },
  { key: 'cancelled',   label: 'Cancelada' },
];

/**
 * @param {Object} props
 * @param {any=} props.tasks
 * @param {any=} props.onOpenTask
 * @param {any=} props.planId
 * @param {any=} props.tenantId
 * @param {any=} props.onNewReview
 */
export default function ListaExecutivaTab({ tasks, onOpenTask, planId, tenantId, onNewReview }) {
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDim, setFilterDim]       = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterResponsavel, setFilterResponsavel] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [search, setSearch] = useState('');
  const today = new Date();
  const qc = useQueryClient();
  const { isReviewMode, review_id } = useReviewMode();

  const dims   = useMemo(() => [...new Set(tasks.map(t => t.dimension_key).filter(Boolean))], [tasks]);
  const owners = useMemo(() => [...new Set(tasks.map(t => t.owner_name || t.assigned_to).filter(Boolean))], [tasks]);
  // Entidades avaliadas presentes no plano (assessments multi_entity_master)
  // — tarefas estratégicas (cluster/dimensão) não têm entidade, só as
  // operacionais (nível de pergunta) que vieram de uma resposta específica.
  const entities = useMemo(() => {
    const map = new Map();
    for (const t of tasks) if (t.evaluated_entity_id) map.set(t.evaluated_entity_id, t.evaluated_entity_name || t.evaluated_entity_id);
    return [...map.entries()];
  }, [tasks]);

  const filtered = useMemo(() => {
    return tasks.filter(t => {
      if (filterStatus === 'active')   { if (t.status === 'done' || t.status === 'cancelled') return false; }
      else if (filterStatus === 'done')    { if (t.status !== 'done') return false; }
      else if (filterStatus === 'blocked') { if (!t.is_blocked && t.status !== 'blocked') return false; }
      else if (filterStatus === 'overdue') {
        if (!t.due_date || t.status === 'done' || !isAfter(today, new Date(t.due_date))) return false;
      }
      else if (filterStatus === 'no_owner') { if (t.assigned_to || t.owner_name) return false; }
      else if (filterStatus === 'no_due')   { if (t.due_date || t.status === 'done') return false; }
      if (filterDim && t.dimension_key !== filterDim)       return false;
      if (filterPriority && t.priority !== filterPriority)  return false;
      if (filterResponsavel && t.owner_name !== filterResponsavel && t.assigned_to !== filterResponsavel) return false;
      if (filterEntity && t.evaluated_entity_id !== filterEntity) return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tasks, filterStatus, filterDim, filterPriority, filterResponsavel, filterEntity, search, today]);

  const handleInlineUpdate = async (taskId, updates) => {
    await base44.functions.invoke('updateActionTaskWithHistory', {
      task_id: taskId, 
      updates, 
      source: 'lista_executiva',
      review_id: isReviewMode ? review_id : undefined,
    });
    invalidateActionPlanQueries(qc, null, planId, tenantId);
  };

  return (
    <div className="relative space-y-3">
      {/* Review Mode Overlay */}
      {isReviewMode && <ReviewModeOverlay />}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar tarefa..."
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-blue-300 focus:outline-none w-48"
        />
        <FilterPill value={filterStatus} onChange={setFilterStatus} options={[
          ['active','Abertas'],['done','Concluídas'],['blocked','Bloqueadas'],
          ['overdue','Vencidas'],['no_owner','Sem dono'],['no_due','Sem prazo'],['all','Todas'],
        ]} />
        {dims.length > 0 && (
          <select value={filterDim} onChange={e => setFilterDim(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-blue-300 focus:outline-none">
            <option value="">Todas dimensões</option>
            {dims.map(d => <option key={d} value={d}>{DIM_LABELS[d] || d}</option>)}
          </select>
        )}
        {entities.length > 0 && (
          <select value={filterEntity} onChange={e => setFilterEntity(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-blue-300 focus:outline-none">
            <option value="">Todas entidades</option>
            {entities.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        )}
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-blue-300 focus:outline-none">
          <option value="">Todas prioridades</option>
          <option value="critical">Crítico</option>
          <option value="high">Alta</option>
          <option value="medium">Média</option>
          <option value="low">Baixa</option>
        </select>
        {owners.length > 0 && (
          <select value={filterResponsavel} onChange={e => setFilterResponsavel(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-blue-300 focus:outline-none">
            <option value="">Todos responsáveis</option>
            {owners.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} tarefa{filtered.length !== 1 ? 's' : ''}</span>
        {onNewReview && (
          <button
            onClick={onNewReview}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0"
          >
            <GitBranch className="w-3.5 h-3.5" /> Nova Revisão
          </button>
        )}
      </div>

      {/* Table — full width, sticky first column */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ tableLayout: 'fixed', minWidth: 1050 }}>
            <colgroup>
              <col style={{ width: 28 }} />
              {/* Dimensão — sticky */}
              <col style={{ width: 110 }} />
              {/* Cluster */}
              <col style={{ width: 140 }} />
              {/* Entidade */}
              <col style={{ width: 120 }} />
              {/* Tarefa */}
              <col style={{ width: 260 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 85 }} />
              <col style={{ width: 125 }} />
              <col style={{ width: 85 }} />
              <col style={{ width: 28 }} />
            </colgroup>
            <thead>
              <tr className="bg-slate-800">
                <th className="px-3 py-2.5 w-7" />
                {/* Dimensão sticky header */}
                <th className="text-left px-3 py-2.5 font-semibold text-white sticky left-0 bg-slate-800 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">Dimensão</th>
                <th className="text-left px-3 py-2.5 font-semibold text-white">Cluster</th>
                <th className="text-left px-3 py-2.5 font-semibold text-white">Entidade</th>
                <th className="text-left px-3 py-2.5 font-semibold text-white">Tarefa</th>
                <th className="text-left px-3 py-2.5 font-semibold text-white">Origem</th>
                <th className="text-left px-3 py-2.5 font-semibold text-white">Responsável</th>
                <th className="text-left px-3 py-2.5 font-semibold text-white">Prazo</th>
                <th className="text-left px-3 py-2.5 font-semibold text-white">Status</th>
                <th className="text-left px-3 py-2.5 font-semibold text-white">Progresso</th>
                <th className="w-7" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-16 text-slate-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Nenhuma tarefa nesta visualização.
                  </td>
                </tr>
              ) : filtered.map(task => (
                <TaskTableRow
                  key={task.id}
                  task={task}
                  today={today}
                  onOpenTask={onOpenTask}
                  onInlineUpdate={handleInlineUpdate}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Interactive Table Row ── */
function TaskTableRow({ task, today, onOpenTask, onInlineUpdate }) {
  const p = PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.medium;
  const s = STATUS_STYLE[task.status]     || STATUS_STYLE.todo;
  const isOverdue = task.due_date && task.status !== 'done' && isAfter(today, new Date(task.due_date));
  const isDone    = task.status === 'done';

  // Inline edit states
  const [editingOwner, setEditingOwner] = useState(false);
  const [editingDate,  setEditingDate]  = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [ownerVal,  setOwnerVal]  = useState(task.owner_name || task.assigned_to || '');
  const [dateVal,   setDateVal]   = useState(task.due_date || '');
  const ownerRef = useRef(null);

  const saveOwner = async () => {
    setEditingOwner(false);
    if (ownerVal !== (task.owner_name || task.assigned_to || '')) {
      await onInlineUpdate(task.id, { owner_name: ownerVal, assigned_to: ownerVal });
    }
  };
  const saveDate = async (val) => {
    setDateVal(val);
    setEditingDate(false);
    if (val !== (task.due_date || '')) {
      await onInlineUpdate(task.id, { due_date: val || null });
    }
  };
  const saveStatus = async (newStatus) => {
    setEditingStatus(false);
    if (newStatus !== task.status) {
      const updates = { status: newStatus };
      if (newStatus === 'done') updates.progress_percentage = 100;
      await onInlineUpdate(task.id, updates);
    }
  };

  const stopProp = e => e.stopPropagation();

  return (
    <tr className={`hover:bg-slate-50/80 transition-colors group ${isDone ? 'opacity-60' : ''}`}>
      {/* Priority dot */}
      <td className="px-3 py-3">
        <span className={`w-2 h-2 rounded-full block ${p.dot} ${isDone ? 'opacity-30' : ''}`} />
      </td>

      {/* Dimensão — sticky */}
      <td
        className="px-3 py-3 sticky left-0 bg-white group-hover:bg-slate-50/80 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] transition-colors"
        onClick={() => onOpenTask(task)}
      >
        {task.dimension_key ? (
          <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 truncate max-w-[100px]">
            {DIM_LABELS[task.dimension_key] || task.dimension_key}
          </span>
        ) : <span className="text-slate-300">—</span>}
      </td>

      {/* Cluster */}
      <td className="px-3 py-3 cursor-pointer" onClick={() => onOpenTask(task)}>
        {task.cluster_key ? (
          <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 truncate max-w-[130px]" title={task.cluster_key}>
            {task.cluster_key}
          </span>
        ) : <span className="text-slate-300">—</span>}
      </td>

      {/* Entidade avaliada (assessment multi-entidade) */}
      <td className="px-3 py-3 cursor-pointer" onClick={() => onOpenTask(task)}>
        {task.evaluated_entity_name ? (
          <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 truncate max-w-[110px]" title={task.evaluated_entity_name}>
            {task.evaluated_entity_name}
          </span>
        ) : <span className="text-slate-300">—</span>}
      </td>

      {/* Tarefa title */}
      <td className="px-3 py-3 cursor-pointer" onClick={() => onOpenTask(task)}>
        <div className="flex items-start gap-1.5">
          <p className={`font-medium leading-snug ${isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>
            {task.title}
          </p>
          {task.is_blocked && <Lock className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />}
          {isOverdue && <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />}
        </div>
        {task.blocked_reason && (
          <p className="text-[10px] text-amber-600 mt-0.5 truncate">🔒 {task.blocked_reason}</p>
        )}
      </td>

      {/* Origem */}
      <td className="px-3 py-3 text-slate-400 cursor-pointer" onClick={() => onOpenTask(task)}>
        {ORIGIN_SHORT[task.origin_type] || '—'}
      </td>

      {/* Responsável — inline edit */}
      <td className="px-3 py-3" onClick={stopProp}>
        {editingOwner ? (
          <div className="flex items-center gap-1">
            <input
              ref={ownerRef}
              autoFocus
              value={ownerVal}
              onChange={e => setOwnerVal(e.target.value)}
              onBlur={saveOwner}
              onKeyDown={e => { if (e.key === 'Enter') saveOwner(); if (e.key === 'Escape') setEditingOwner(false); }}
              className="text-xs border border-blue-300 rounded px-2 py-1 w-24 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <button onClick={saveOwner} className="text-emerald-600 hover:text-emerald-800"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setEditingOwner(false)} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <button
            onClick={() => { setEditingOwner(true); setOwnerVal(task.owner_name || task.assigned_to || ''); }}
            className="flex items-center gap-1 group/owner hover:text-blue-600 transition-colors"
          >
            {!task.assigned_to && !task.owner_name ? (
              <span className="flex items-center gap-1 text-amber-400"><User className="w-3 h-3" /> <span className="text-[10px]">—</span></span>
            ) : (
              <span className="text-slate-600 truncate max-w-[100px]">{task.owner_name || task.assigned_to}</span>
            )}
            <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover/owner:opacity-100 text-slate-400 transition-opacity flex-shrink-0" />
          </button>
        )}
      </td>

      {/* Prazo — inline date picker */}
      <td className="px-3 py-3" onClick={stopProp}>
        {editingDate ? (
          <input
            type="date"
            autoFocus
            value={dateVal}
            onChange={e => saveDate(e.target.value)}
            onBlur={() => setEditingDate(false)}
            className="text-xs border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        ) : (
          <button
            onClick={() => setEditingDate(true)}
            className="flex items-center gap-1 group/date hover:text-blue-600 transition-colors"
          >
            {!task.due_date ? (
              <span className="flex items-center gap-1 text-amber-400"><Calendar className="w-3 h-3" /> <span className="text-[10px]">—</span></span>
            ) : (
              <span className={`font-medium ${isOverdue ? 'text-red-600' : 'text-slate-500'}`}>
                {format(new Date(String(task.due_date).slice(0, 10) + 'T12:00'), 'dd/MM/yy')}
              </span>
            )}
            <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover/date:opacity-100 text-slate-400 transition-opacity flex-shrink-0" />
          </button>
        )}
      </td>

      {/* Status — inline dropdown */}
      <td className="px-3 py-3" onClick={stopProp}>
        {editingStatus ? (
          <div className="relative">
            <select
              autoFocus
              defaultValue={task.status}
              onChange={e => saveStatus(e.target.value)}
              onBlur={() => setEditingStatus(false)}
              className="text-xs border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {STATUS_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>
        ) : (
          <button onClick={() => setEditingStatus(true)} className="group/status">
            <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] ${s.cls} hover:ring-1 hover:ring-blue-300 transition-all`}>
              {s.label}
            </span>
          </button>
        )}
      </td>

      {/* Progresso */}
      <td className="px-3 py-3" onClick={() => onOpenTask(task)}>
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
            <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${task.progress_percentage || 0}%` }} />
          </div>
          <span className="text-[10px] text-slate-400 w-6">{task.progress_percentage || 0}%</span>
        </div>
      </td>

      {/* Open arrow */}
      <td className="px-2 py-3 cursor-pointer" onClick={() => onOpenTask(task)}>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
      </td>
    </tr>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.value
 * @param {any=} props.onChange
 * @param {any=} props.options
 */
function FilterPill({ value, onChange, options }) {
  return (
    <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 flex-wrap">
      {options.map(([val, lbl]) => (
        <button key={val} onClick={() => onChange(val)}
          className={`px-2 py-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap ${value === val ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >{lbl}</button>
      ))}
    </div>
  );
}