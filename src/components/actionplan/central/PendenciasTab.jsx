import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { PRIORITY_STYLE, DIM_LABELS } from '../APlanConstants';

function calcIssues(task) {
  const issues = [];
  if (!task.assigned_to && !task.owner_name) issues.push({ type: 'warn', msg: 'Sem responsável definido' });
  if (!task.due_date) issues.push({ type: 'warn', msg: 'Sem prazo definido' });
  if (!task.expected_evidence) issues.push({ type: 'warn', msg: 'Sem evidência esperada' });
  if (task.status === 'blocked' && !task.blocked_reason) issues.push({ type: 'error', msg: 'Bloqueada sem motivo registrado' });
  if (task.status === 'done' && (task.progress_percentage || 0) < 100) issues.push({ type: 'warn', msg: 'Concluída com progresso < 100%' });
  if ((task.progress_percentage || 0) >= 100 && task.status !== 'done' && task.status !== 'cancelled') issues.push({ type: 'warn', msg: 'Progresso 100% mas status não é Concluída' });
  if (task.status === 'done' && !task.completion_evidence) issues.push({ type: 'info', msg: 'Concluída sem evidência entregue' });
  if (!task.origin_type || task.origin_type === 'manual') {
    if (!task.reason && !task.origin_detail) issues.push({ type: 'info', msg: 'Sem conexão com diagnóstico' });
  }
  return issues;
}

/**
 * @param {Object} props
 * @param {any=} props.tasks
 * @param {any=} props.onOpenTask
 */
export default function PendenciasTab({ tasks, onOpenTask }) {
  const activeTasks = tasks.filter(t => t.status !== 'cancelled' && t.status !== 'done');
  const tasksWithIssues = activeTasks
    .map(t => ({ task: t, issues: calcIssues(t) }))
    .filter(({ issues }) => issues.length > 0)
    .sort((a, b) => {
      const scoreA = a.issues.filter(i => i.type === 'error').length * 3 + a.issues.filter(i => i.type === 'warn').length;
      const scoreB = b.issues.filter(i => i.type === 'error').length * 3 + b.issues.filter(i => i.type === 'warn').length;
      return scoreB - scoreA;
    });

  const errorCount = tasksWithIssues.filter(({ issues }) => issues.some(i => i.type === 'error')).length;
  const warnCount = tasksWithIssues.filter(({ issues }) => issues.every(i => i.type !== 'error')).length;

  if (tasksWithIssues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
        <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        <p className="text-sm font-semibold text-emerald-600">Nenhuma pendência de estruturação!</p>
        <p className="text-xs">Todas as tarefas ativas estão bem configuradas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="font-semibold text-red-700">{errorCount} crítica{errorCount !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="font-semibold text-amber-700">{warnCount} atenção</span>
        </div>
        <span className="text-xs text-slate-400">{tasksWithIssues.length} tarefas com pendências</span>
      </div>

      <div className="space-y-3">
        {tasksWithIssues.map(({ task, issues }) => {
          const p = PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.medium;
          const hasError = issues.some(i => i.type === 'error');

          return (
            <div
              key={task.id}
              className={`rounded-xl border bg-white cursor-pointer hover:shadow-md transition-all ${hasError ? 'border-red-300' : 'border-amber-200'}`}
              onClick={() => onOpenTask(task)}
            >
              <div className="flex items-start gap-3 p-4">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${p.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 leading-snug mb-1">{task.title}</p>
                  <p className="text-[10px] text-slate-400 mb-2">{DIM_LABELS[task.dimension_key] || task.dimension_key || 'Sem dimensão'}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {issues.map((issue, i) => (
                      <span key={i} className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                        issue.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
                        issue.type === 'warn' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-slate-50 text-slate-500 border-slate-200'
                      }`}>
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {issue.msg}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}