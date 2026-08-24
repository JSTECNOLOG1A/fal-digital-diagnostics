import React from 'react';
import { AlertTriangle, CheckCircle2, Lock, GitBranch } from 'lucide-react';
import { PRIORITY_STYLE, DIM_LABELS, STATUS_STYLE } from '../APlanConstants';

/**
 * @param {Object} props
 * @param {any=} props.tasks
 * @param {any=} props.onOpenTask
 */
export default function DependenciesTab({ tasks, onOpenTask }) {
  const taskMap = {};
  tasks.forEach(t => { if (t.task_key) taskMap[t.task_key] = t; });

  const withDeps = tasks.filter(t => t.dependency_task_keys?.length > 0);
  const blocking = tasks.filter(t => {
    if (!t.task_key) return false;
    return tasks.some(other => other.dependency_task_keys?.includes(t.task_key));
  });

  if (withDeps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
        <GitBranch className="w-10 h-10 opacity-30" />
        <p className="text-sm font-medium">Nenhuma dependência mapeada.</p>
        <p className="text-xs">Dependências são definidas nos campos das tarefas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-500">{withDeps.length} tarefa{withDeps.length !== 1 ? 's' : ''} com dependências mapeadas.</p>

      <div className="space-y-3">
        {withDeps.map(task => {
          const deps = (task.dependency_task_keys || []).map(k => taskMap[k]).filter(Boolean);
          const hasPending = deps.some(d => d.status !== 'done');
          const p = PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.medium;
          const s = STATUS_STYLE[task.status] || STATUS_STYLE.todo;

          return (
            <div key={task.id} className={`rounded-xl border bg-white overflow-hidden ${hasPending && task.status !== 'done' ? 'border-amber-300' : 'border-slate-200'}`}>
              {/* Main task */}
              <div
                className="flex items-start gap-3 p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => onOpenTask(task)}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${p.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 leading-snug">{task.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] text-slate-400">{DIM_LABELS[task.dimension_key] || task.dimension_key || '—'}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
                    {hasPending && task.status !== 'done' && (
                      <span className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium">
                        <AlertTriangle className="w-3 h-3" /> Dependência pendente
                      </span>
                    )}
                  </div>
                </div>
                {task.is_blocked && <Lock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-1" />}
              </div>

              {/* Dependencies */}
              {deps.length > 0 && (
                <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 space-y-2">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Depende de:</p>
                  {deps.map(dep => (
                    <div
                      key={dep.id}
                      className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100 cursor-pointer hover:border-slate-200 transition-colors"
                      onClick={() => onOpenTask(dep)}
                    >
                      {dep.status === 'done'
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        : <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 flex-shrink-0" />
                      }
                      <span className={`text-xs flex-1 truncate ${dep.status === 'done' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                        {dep.title}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                        dep.status === 'done' ? 'bg-emerald-100 text-emerald-600' :
                        dep.status === 'blocked' ? 'bg-amber-100 text-amber-600' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {dep.status === 'done' ? 'Concluída' : dep.status === 'in_progress' ? 'Em andamento' : dep.status === 'blocked' ? 'Bloqueada' : 'Pendente'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}