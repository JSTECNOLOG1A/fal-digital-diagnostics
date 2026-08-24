import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';

const STATUS_LABELS = {
  todo: 'A fazer', in_progress: 'Em andamento', blocked: 'Bloqueada',
  done: 'Concluída', cancelled: 'Cancelada',
};
const STATUS_COLORS = {
  todo: 'bg-slate-100 text-slate-700', in_progress: 'bg-blue-100 text-blue-700',
  blocked: 'bg-amber-100 text-amber-700', done: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

/**
 * @param {Object} props
 * @param {any=} props.delta
 * @param {any=} props.positiveIsGood
 */
function DeltaBadge({ delta, positiveIsGood = true }) {
  if (delta === 0) return <span className="inline-flex items-center gap-1 text-slate-500 text-xs"><Minus className="w-3 h-3" /> 0</span>;
  const isGood = positiveIsGood ? delta > 0 : delta < 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold ${isGood ? 'text-green-600' : 'text-red-600'}`}>
      {delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {delta > 0 ? '+' : ''}{delta}
    </span>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.plan_id
 * @param {any=} props.reviews
 * @param {any=} props.tenant_id
 */
export default function ReviewComparisonTab({ plan_id, reviews, tenant_id }) {
  const [selectedBefore, setSelectedBefore] = useState(null);
  const [selectedAfter, setSelectedAfter] = useState(null);
  const [currentTasksCache, setCurrentTasksCache] = useState(null);
  const [loadingCurrent, setLoadingCurrent] = useState(false);

  // Marcos disponíveis — "Posição Atual" incluída
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

  // Carregar tarefas atuais se necessário
  const loadCurrentSnapshot = async () => {
    if (currentTasksCache) return currentTasksCache;
    setLoadingCurrent(true);
    try {
      const tasks = await base44.entities.ActionTask.filter({ plan_id, tenant_id }, '-priority_score', 500);
      const active = tasks.filter(t => t.status !== 'cancelled');
      const today = new Date();
      const done = active.filter(t => t.status === 'done').length;
      const snap = {
        summary: {
          total_tasks: active.length,
          done_tasks: done,
          in_progress_tasks: active.filter(t => t.status === 'in_progress').length,
          blocked_tasks: active.filter(t => t.status === 'blocked').length,
          todo_tasks: active.filter(t => t.status === 'todo').length,
          overdue_tasks: active.filter(t => t.due_date && new Date(t.due_date) < today && t.status !== 'done').length,
          average_progress: active.length > 0 ? Math.round(active.reduce((s, t) => s + (t.progress_percentage || 0), 0) / active.length) : 0,
        },
        tasks: active.map(t => ({
          task_id: t.id, title: t.title, status: t.status,
          progress_percentage: t.progress_percentage || 0,
          owner_name: t.owner_name || t.assigned_to,
          due_date: t.due_date, dimension_key: t.dimension_key, priority: t.priority,
        })),
      };
      setCurrentTasksCache(snap);
      return snap;
    } finally {
      setLoadingCurrent(false);
    }
  };

  const resolveSnapshot = async (marco) => {
    if (!marco) return null;
    if (marco.type === 'current') return loadCurrentSnapshot();
    if (marco.type === 'opening') return marco.review.opening_snapshot;
    if (marco.type === 'closing') return marco.review.closing_snapshot;
    return null;
  };

  const [beforeSnapshot, setBeforeSnapshot] = useState(null);
  const [afterSnapshot, setAfterSnapshot] = useState(null);
  const [resolving, setResolving] = useState(false);

  const handleSelectBefore = async (marco) => {
    setSelectedBefore(marco);
    setResolving(true);
    const snap = await resolveSnapshot(marco);
    setBeforeSnapshot(snap);
    setResolving(false);
  };

  const handleSelectAfter = async (marco) => {
    setSelectedAfter(marco);
    setResolving(true);
    const snap = await resolveSnapshot(marco);
    setAfterSnapshot(snap);
    setResolving(false);
  };

  // Comparação de tarefas por task_id
  const taskComparison = useMemo(() => {
    if (!beforeSnapshot?.tasks || !afterSnapshot?.tasks) return null;

    const beforeMap = Object.fromEntries(beforeSnapshot.tasks.map(t => [t.task_id, t]));
    const afterMap = Object.fromEntries(afterSnapshot.tasks.map(t => [t.task_id, t]));
    const allIds = new Set([...Object.keys(beforeMap), ...Object.keys(afterMap)]);

    const advanced = [], regressed = [], completed = [], newlyBlocked = [],
      unblocked = [], rescheduled = [], ownerChanged = [], noMovement = [], newTasks = [];

    for (const id of allIds) {
      const before = beforeMap[id];
      const after = afterMap[id];

      if (!before && after) { newTasks.push(after); continue; }
      if (!after) continue;

      const progressDelta = (after.progress_percentage || 0) - (before.progress_percentage || 0);
      const statusChanged = before.status !== after.status;
      const dueDateChanged = before.due_date !== after.due_date;
      const ownerChangedFlag = (before.owner_name || '') !== (after.owner_name || '');

      if (after.status === 'done' && before.status !== 'done') { completed.push({ before, after }); continue; }
      if (before.status === 'blocked' && after.status !== 'blocked') { unblocked.push({ before, after }); continue; }
      if (after.status === 'blocked' && before.status !== 'blocked') { newlyBlocked.push({ before, after }); continue; }
      if (progressDelta > 0) { advanced.push({ before, after, delta: progressDelta }); continue; }
      if (progressDelta < 0) { regressed.push({ before, after, delta: progressDelta }); continue; }
      if (ownerChangedFlag) { ownerChanged.push({ before, after }); continue; }
      if (dueDateChanged) { rescheduled.push({ before, after }); continue; }
      noMovement.push({ before, after });
    }

    return { advanced, regressed, completed, newlyBlocked, unblocked, rescheduled, ownerChanged, noMovement, newTasks };
  }, [beforeSnapshot, afterSnapshot]);

  // Métricas agregadas
  const summaryMetrics = [
    { key: 'total_tasks', label: 'Total de Tarefas', positiveIsGood: true },
    { key: 'done_tasks', label: 'Concluídas', positiveIsGood: true },
    { key: 'in_progress_tasks', label: 'Em Execução', positiveIsGood: true },
    { key: 'blocked_tasks', label: 'Bloqueadas', positiveIsGood: false },
    { key: 'overdue_tasks', label: 'Vencidas', positiveIsGood: false },
    { key: 'average_progress', label: 'Progresso Médio (%)', positiveIsGood: true },
  ];

  const canCompare = beforeSnapshot && afterSnapshot;

  return (
    <div className="space-y-4">
      {/* Marco selector */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Antes', selected: selectedBefore, onSelect: handleSelectBefore },
          { label: 'Depois', selected: selectedAfter, onSelect: handleSelectAfter },
        ].map(({ label, selected, onSelect }) => (
          <div key={label} className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="font-semibold text-sm mb-3 text-slate-700">{label}</h3>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {marcos.map(marco => (
                <button
                  key={marco.id}
                  onClick={() => onSelect(marco)}
                  className={`w-full p-2 rounded text-left text-xs transition-colors ${
                    selected?.id === marco.id
                      ? 'bg-blue-100 border border-blue-400 font-semibold'
                      : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {marco.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {(resolving || loadingCurrent) && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin mr-2 text-blue-500" />
          <span className="text-sm text-slate-500">Carregando posição...</span>
        </div>
      )}

      {!canCompare && !resolving && (
        <div className="text-center py-10 text-slate-400 text-sm">Selecione os dois marcos para comparar</div>
      )}

      {canCompare && !resolving && (
        <>
          {/* Métricas agregadas */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="font-semibold text-sm mb-3">Métricas Gerais</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {summaryMetrics.map(m => {
                const before = beforeSnapshot.summary?.[m.key] ?? 0;
                const after = afterSnapshot.summary?.[m.key] ?? 0;
                const delta = after - before;
                return (
                  <div key={m.key} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] text-slate-500 mb-1">{m.label}</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-slate-400">{before}</span>
                      <span className="text-slate-300">→</span>
                      <span className="text-base font-bold text-slate-800">{after}</span>
                      <DeltaBadge delta={delta} positiveIsGood={m.positiveIsGood} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Movimentos por tarefa */}
          {taskComparison && (
            <div className="space-y-3">
              <TaskGroup
                title="✅ Concluídas no período"
                tasks={taskComparison.completed}
                color="green"
                renderRow={({ before, after }) => (
                  <TaskRow title={after.title} leftBadge={{ label: STATUS_LABELS[before.status], cls: STATUS_COLORS[before.status] }} rightBadge={{ label: 'Concluída', cls: STATUS_COLORS.done }} />
                )}
              />
              <TaskGroup
                title="📈 Avançaram (progresso)"
                tasks={taskComparison.advanced}
                color="blue"
                renderRow={({ before, after, delta }) => (
                  <TaskRow title={after.title} leftBadge={{ label: `${before.progress_percentage || 0}%`, cls: 'bg-slate-100 text-slate-600' }} rightBadge={{ label: `${after.progress_percentage || 0}% (+${delta}%)`, cls: 'bg-blue-100 text-blue-700' }} />
                )}
              />
              <TaskGroup
                title="🔓 Desbloqueadas"
                tasks={taskComparison.unblocked}
                color="emerald"
                renderRow={({ before, after }) => (
                  <TaskRow title={after.title} leftBadge={{ label: 'Bloqueada', cls: STATUS_COLORS.blocked }} rightBadge={{ label: STATUS_LABELS[after.status], cls: STATUS_COLORS[after.status] }} />
                )}
              />
              <TaskGroup
                title="🔒 Bloqueadas no período"
                tasks={taskComparison.newlyBlocked}
                color="amber"
                renderRow={({ before, after }) => (
                  <TaskRow title={after.title} leftBadge={{ label: STATUS_LABELS[before.status], cls: STATUS_COLORS[before.status] }} rightBadge={{ label: 'Bloqueada', cls: STATUS_COLORS.blocked }} />
                )}
              />
              <TaskGroup
                title="📉 Retrocederam"
                tasks={taskComparison.regressed}
                color="red"
                renderRow={({ before, after, delta }) => (
                  <TaskRow title={after.title} leftBadge={{ label: `${before.progress_percentage || 0}%`, cls: 'bg-slate-100 text-slate-600' }} rightBadge={{ label: `${after.progress_percentage || 0}% (${delta}%)`, cls: 'bg-red-100 text-red-700' }} />
                )}
              />
              <TaskGroup
                title="🔄 Reprogramadas"
                tasks={taskComparison.rescheduled}
                color="purple"
                renderRow={({ before, after }) => (
                  <TaskRow title={after.title} leftBadge={{ label: before.due_date || 'sem prazo', cls: 'bg-slate-100 text-slate-600' }} rightBadge={{ label: after.due_date || 'sem prazo', cls: 'bg-purple-100 text-purple-700' }} />
                )}
              />
              <TaskGroup
                title="👤 Trocaram responsável"
                tasks={taskComparison.ownerChanged}
                color="indigo"
                renderRow={({ before, after }) => (
                  <TaskRow title={after.title} leftBadge={{ label: before.owner_name || 'sem responsável', cls: 'bg-slate-100 text-slate-600' }} rightBadge={{ label: after.owner_name || 'sem responsável', cls: 'bg-indigo-100 text-indigo-700' }} />
                )}
              />
              <TaskGroup
                title="➕ Novas tarefas"
                tasks={taskComparison.newTasks}
                color="teal"
                renderRow={(task) => (
                  <TaskRow title={task.title} rightBadge={{ label: 'Nova', cls: 'bg-teal-100 text-teal-700' }} />
                )}
              />
              <TaskGroup
                title="⏸ Sem movimentação"
                tasks={taskComparison.noMovement}
                color="slate"
                renderRow={({ after }) => (
                  <TaskRow title={after.title} rightBadge={{ label: `${after.progress_percentage || 0}%`, cls: 'bg-slate-100 text-slate-500' }} />
                )}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.title
 * @param {any=} props.tasks
 * @param {any=} props.color
 * @param {any=} props.renderRow
 */
function TaskGroup({ title, tasks, color, renderRow }) {
  const [open, setOpen] = useState(true);
  if (!tasks || tasks.length === 0) return null;
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-${color}-100 text-${color}-700`}>{tasks.length}</span>
      </button>
      {open && (
        <div className="divide-y divide-slate-100">
          {tasks.map((item, i) => (
            <div key={i} className="px-4">
              {renderRow(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.title
 * @param {any=} props.leftBadge
 * @param {any=} props.rightBadge
 */
function TaskRow({ title, leftBadge, rightBadge }) {
  return (
    <div className="flex items-center gap-2 py-2">
      {leftBadge && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${leftBadge.cls}`}>{leftBadge.label}</span>
      )}
      {leftBadge && <span className="text-slate-300 text-xs">→</span>}
      <span className="flex-1 text-xs text-slate-700 truncate">{title}</span>
      {rightBadge && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap ${rightBadge.cls}`}>{rightBadge.label}</span>
      )}
    </div>
  );
}