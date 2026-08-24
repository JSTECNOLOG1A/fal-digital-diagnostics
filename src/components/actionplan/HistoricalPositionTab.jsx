import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Calendar, Loader2, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

const STATUS_LABELS = {
  todo: 'A fazer', in_progress: 'Em andamento', blocked: 'Bloqueada',
  done: 'Concluída', cancelled: 'Cancelada',
};
const STATUS_COLORS = {
  todo: 'bg-slate-100 text-slate-700', in_progress: 'bg-blue-100 text-blue-700',
  blocked: 'bg-amber-100 text-amber-700', done: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};
const PRIORITY_LABELS = { critical: 'Crítica', high: 'Alta', medium: 'Média', low: 'Baixa' };

/**
 * @param {Object} props
 * @param {any=} props.plan_id
 * @param {any=} props.reviews
 * @param {any=} props.tenant_id
 */
export default function HistoricalPositionTab({ plan_id, reviews, tenant_id }) {
  const [selectedMarco, setSelectedMarco] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDimension, setFilterDimension] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterOwner, setFilterOwner] = useState('');
  const [filterFlag, setFilterFlag] = useState('all');

  const marcos = useMemo(() => [
    { id: 'current', label: 'Posição Atual', type: 'current' },
    ...reviews.map(rev => ({
      id: `${rev.id}_opening`,
      label: `Abertura - R${rev.review_number} (${new Date(rev.review_date).toLocaleDateString('pt-BR')})`,
      type: 'opening', review: rev,
    })),
    ...reviews.filter(rev => rev.status === 'completed').map(rev => ({
      id: `${rev.id}_closing`,
      label: `Fechamento - R${rev.review_number} (${new Date(rev.completed_at).toLocaleDateString('pt-BR')})`,
      type: 'closing', review: rev,
    })),
  ], [reviews]);

  const handleLoadSnapshot = async (marco) => {
    setSelectedMarco(marco);
    setLoading(true);
    setSnapshot(null);
    try {
      if (marco.type === 'current') {
        const tasks = await base44.entities.ActionTask.filter({ plan_id, tenant_id }, '-priority_score', 500);
        const active = tasks.filter(t => t.status !== 'cancelled');
        const today = new Date();
        const done = active.filter(t => t.status === 'done').length;
        setSnapshot({
          summary: {
            total_tasks: active.length,
            done_tasks: done,
            in_progress_tasks: active.filter(t => t.status === 'in_progress').length,
            blocked_tasks: active.filter(t => t.status === 'blocked').length,
            todo_tasks: active.filter(t => t.status === 'todo').length,
            overdue_tasks: active.filter(t => t.due_date && new Date(t.due_date) < today && t.status !== 'done').length,
            average_progress: active.length > 0 ? Math.round(active.reduce((s, t) => s + (t.progress_percentage || 0), 0) / active.length) : 0,
            progress_percentage: active.length > 0 ? Math.round((done / active.length) * 100) : 0,
          },
          tasks: active.map(t => ({
            task_id: t.id, title: t.title, status: t.status, assigned_to: t.assigned_to,
            owner_name: t.owner_name, due_date: t.due_date, progress_percentage: t.progress_percentage || 0,
            dimension_key: t.dimension_key, priority: t.priority, expected_evidence: t.expected_evidence,
            blocked_reason: t.blocked_reason,
          })),
        });
      } else if (marco.type === 'opening') {
        setSnapshot(marco.review.opening_snapshot);
      } else if (marco.type === 'closing') {
        setSnapshot(marco.review.closing_snapshot);
      }
    } finally {
      setLoading(false);
    }
  };

  // Dimensões únicas do snapshot
  const dimensions = useMemo(() => {
    if (!snapshot?.tasks) return [];
    return [...new Set(snapshot.tasks.map(t => t.dimension_key).filter(Boolean))];
  }, [snapshot]);

  // Tarefas filtradas
  const filteredTasks = useMemo(() => {
    if (!snapshot?.tasks) return [];
    const today = new Date();
    return snapshot.tasks.filter(t => {
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (filterDimension !== 'all' && t.dimension_key !== filterDimension) return false;
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
      if (filterOwner && !(t.owner_name || t.assigned_to || '').toLowerCase().includes(filterOwner.toLowerCase())) return false;
      if (filterFlag === 'overdue' && !(t.due_date && new Date(t.due_date) < today && t.status !== 'done')) return false;
      if (filterFlag === 'blocked' && t.status !== 'blocked') return false;
      if (filterFlag === 'no_owner' && (t.owner_name || t.assigned_to)) return false;
      if (filterFlag === 'no_due_date' && t.due_date) return false;
      if (filterFlag === 'no_evidence' && t.expected_evidence) return false;
      return true;
    });
  }, [snapshot, filterStatus, filterDimension, filterPriority, filterOwner, filterFlag]);

  const s = snapshot?.summary;

  return (
    <div className="space-y-4">
      {/* Marco selector */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Selecione um Marco Histórico
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {marcos.map(marco => (
            <button
              key={marco.id}
              onClick={() => handleLoadSnapshot(marco)}
              className={`p-3 rounded-lg text-left text-xs transition-colors ${
                selectedMarco?.id === marco.id
                  ? 'bg-blue-100 border border-blue-400 font-semibold'
                  : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {marco.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin mr-2 text-blue-500" />
          <span className="text-sm text-slate-600">Carregando snapshot...</span>
        </div>
      )}

      {snapshot && !loading && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              { label: 'Total', value: s?.total_tasks || 0, cls: 'text-slate-700' },
              { label: 'Concluídas', value: s?.done_tasks || 0, cls: 'text-green-600' },
              { label: 'Em andamento', value: s?.in_progress_tasks || 0, cls: 'text-blue-600' },
              { label: 'Bloqueadas', value: s?.blocked_tasks || 0, cls: 'text-amber-600' },
              { label: 'Vencidas', value: s?.overdue_tasks || 0, cls: 'text-red-600' },
              { label: 'Progresso médio', value: `${s?.average_progress || 0}%`, cls: 'text-slate-700' },
            ].map(stat => (
              <div key={stat.label} className="bg-white border border-slate-200 rounded-lg p-3 text-center">
                <p className={`text-xl font-black ${stat.cls}`}>{stat.value}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Filtros */}
          {snapshot.tasks?.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="todo">A fazer</SelectItem>
                    <SelectItem value="in_progress">Em andamento</SelectItem>
                    <SelectItem value="blocked">Bloqueada</SelectItem>
                    <SelectItem value="done">Concluída</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterDimension} onValueChange={setFilterDimension}>
                  <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Dimensão" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as dimensões</SelectItem>
                    {dimensions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Prioridade" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="critical">Crítica</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="low">Baixa</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterFlag} onValueChange={setFilterFlag}>
                  <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Situação especial" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Nenhum filtro extra</SelectItem>
                    <SelectItem value="overdue">Vencidas nesta data</SelectItem>
                    <SelectItem value="blocked">Bloqueadas</SelectItem>
                    <SelectItem value="no_owner">Sem responsável</SelectItem>
                    <SelectItem value="no_due_date">Sem prazo</SelectItem>
                    <SelectItem value="no_evidence">Sem evidência esperada</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  className="h-8 w-40 text-xs"
                  placeholder="Responsável..."
                  value={filterOwner}
                  onChange={e => setFilterOwner(e.target.value)}
                />

                <span className="text-xs text-slate-500 ml-auto">{filteredTasks.length} tarefa(s)</span>
              </div>
            </div>
          )}

          {/* Task list — sem limite de slice */}
          {snapshot.tasks && (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                {filteredTasks.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">Nenhuma tarefa para os filtros selecionados.</p>
                ) : filteredTasks.map(task => (
                  <div key={task.task_id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap ${STATUS_COLORS[task.status] || 'bg-slate-100 text-slate-600'}`}>
                      {STATUS_LABELS[task.status] || task.status}
                    </span>
                    <span className="flex-1 text-xs text-slate-800 truncate">{task.title}</span>
                    {task.dimension_key && (
                      <span className="text-[10px] text-slate-400 hidden sm:block">{task.dimension_key}</span>
                    )}
                    {task.priority && (
                      <span className="text-[10px] text-slate-500 hidden md:block">{PRIORITY_LABELS[task.priority] || task.priority}</span>
                    )}
                    {(task.owner_name || task.assigned_to) && (
                      <span className="text-[10px] text-slate-500 hidden md:block truncate max-w-[100px]">{task.owner_name || task.assigned_to}</span>
                    )}
                    <span className="text-[10px] font-bold text-blue-600 whitespace-nowrap">{task.progress_percentage || 0}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}