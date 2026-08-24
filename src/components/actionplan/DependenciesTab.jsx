import React from 'react';
import { GitBranch, CheckCircle2, Clock, Lock, AlertTriangle, ArrowRight } from 'lucide-react';
import { PRIORITY_STYLE, DIM_LABELS, STATUS_STYLE } from './APlanConstants';

/**
 * @param {Object} props
 * @param {any=} props.tasks
 * @param {any=} props.onOpenTask
 */
export default function DependenciesTab({ tasks, onOpenTask }) {
  // Build task map by task_key
  const taskByKey = {};
  tasks.forEach(t => { if (t.task_key) taskByKey[t.task_key] = t; });
  const taskById = {};
  tasks.forEach(t => { taskById[t.id] = t; });

  // Only tasks that have dependencies OR are depended upon
  const tasksWithDeps = tasks.filter(t => t.dependency_task_keys?.length > 0);
  const keysThatBlock = new Set(tasksWithDeps.flatMap(t => t.dependency_task_keys || []));

  // Build "blocks" map: taskKey -> tasks that depend on it
  const blocksMap = {};
  tasksWithDeps.forEach(t => {
    (t.dependency_task_keys || []).forEach(depKey => {
      if (!blocksMap[depKey]) blocksMap[depKey] = [];
      blocksMap[depKey].push(t);
    });
  });

  if (tasksWithDeps.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <GitBranch className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium">Nenhuma dependência registrada.</p>
        <p className="text-xs mt-1">Preencha o campo <code className="bg-slate-100 px-1 rounded">dependency_task_keys</code> nas tarefas para visualizar a cadeia de execução.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
        <GitBranch className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          Esta visão mostra tarefas que dependem de outras para serem iniciadas ou concluídas.
          Tarefas com dependência pendente precisam de atenção prioritária.
        </p>
      </div>

      {tasksWithDeps.map(task => {
        const depTasks = (task.dependency_task_keys || []).map(k => taskByKey[k]).filter(Boolean);
        const hasOpenDeps = depTasks.some(d => d.status !== 'done');
        const p = PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.medium;
        const s = STATUS_STYLE[task.status] || STATUS_STYLE.todo;

        return (
          <div key={task.id} className={`border rounded-xl bg-white overflow-hidden shadow-sm ${hasOpenDeps ? 'border-amber-300' : 'border-slate-200'}`}>
            {/* Task header */}
            <div
              className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => onOpenTask(task)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-800 truncate">{task.title}</p>
                  {hasOpenDeps && (
                    <span className="flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold flex-shrink-0">
                      <Lock className="w-3 h-3" /> Dependência pendente
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 flex-wrap">
                  {task.dimension_key && <span>{DIM_LABELS[task.dimension_key] || task.dimension_key}</span>}
                  <span className={`px-1.5 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
                  <span className={`px-1.5 py-0.5 rounded font-semibold ${p.badge}`}>{p.label}</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0 mt-1" />
            </div>

            {/* Dependencies */}
            <div className="border-t border-slate-100 px-4 py-2 bg-slate-50">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Depende de:</p>
              <div className="space-y-1.5">
                {depTasks.map(dep => {
                  const dp = PRIORITY_STYLE[dep.priority] || PRIORITY_STYLE.medium;
                  const isDone = dep.status === 'done';
                  return (
                    <div
                      key={dep.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:opacity-80 transition-opacity ${
                        isDone ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
                      }`}
                      onClick={() => onOpenTask(dep)}
                    >
                      {isDone
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        : <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      }
                      <p className={`text-xs flex-1 truncate ${isDone ? 'line-through text-slate-400' : 'text-slate-700 font-medium'}`}>{dep.title}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {isDone ? 'Concluída' : 'Pendente'}
                      </span>
                    </div>
                  );
                })}
                {(task.dependency_task_keys || []).filter(k => !taskByKey[k]).map(k => (
                  <div key={k} className="flex items-center gap-2 p-2 rounded-lg border bg-slate-100 border-slate-200 text-xs text-slate-400">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="font-mono">{k}</span>
                    <span className="ml-auto text-[10px]">Tarefa não encontrada</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Also blocks */}
            {blocksMap[task.task_key]?.length > 0 && (
              <div className="border-t border-slate-100 px-4 py-2 bg-white">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Esta tarefa bloqueia:</p>
                <div className="space-y-1">
                  {blocksMap[task.task_key].map(bt => (
                    <div
                      key={bt.id}
                      className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer hover:text-slate-800"
                      onClick={() => onOpenTask(bt)}
                    >
                      <ArrowRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
                      <span className="truncate">{bt.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}