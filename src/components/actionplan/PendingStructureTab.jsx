import React, { useMemo } from 'react';
import { AlertTriangle, User, Calendar, FileText, Lock, CheckCircle2, TrendingUp, ArrowRight } from 'lucide-react';
import { DIM_LABELS, PRIORITY_STYLE, STATUS_STYLE } from './APlanConstants';

const ISSUE_CONFIGS = {
  no_owner:          { label: 'Sem responsável', color: 'text-red-600 bg-red-50 border-red-200', icon: User },
  no_due_date:       { label: 'Sem prazo', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: Calendar },
  no_evidence:       { label: 'Sem evidência esperada', color: 'text-orange-600 bg-orange-50 border-orange-200', icon: FileText },
  blocked_no_reason: { label: 'Bloqueada sem motivo', color: 'text-red-700 bg-red-100 border-red-300', icon: Lock },
  done_no_evidence:  { label: 'Concluída sem evidência entregue', color: 'text-slate-600 bg-slate-50 border-slate-300', icon: CheckCircle2 },
  progress_mismatch: { label: 'Progresso incompatível com status', color: 'text-violet-600 bg-violet-50 border-violet-200', icon: TrendingUp },
  generic_title:     { label: 'Título genérico ou muito curto', color: 'text-slate-500 bg-slate-50 border-slate-200', icon: AlertTriangle },
  no_origin:         { label: 'Sem origem diagnóstica', color: 'text-indigo-600 bg-indigo-50 border-indigo-200', icon: AlertTriangle },
};

function getIssues(task) {
  const issues = [];
  if (!task.assigned_to && !task.owner_name) issues.push('no_owner');
  if (!task.due_date) issues.push('no_due_date');
  if (!task.expected_evidence) issues.push('no_evidence');
  if ((task.status === 'blocked' || task.is_blocked) && !task.blocked_reason) issues.push('blocked_no_reason');
  if (task.status === 'done' && !task.completion_evidence) issues.push('done_no_evidence');
  if (task.status === 'done' && (task.progress_percentage || 0) < 100) issues.push('progress_mismatch');
  if (task.progress_percentage === 100 && task.status !== 'done' && task.status !== 'cancelled') issues.push('progress_mismatch');
  if (!task.title || task.title.trim().length < 10) issues.push('generic_title');
  if (!task.origin_type || task.origin_type === 'manual') {
    if (!task.reason && !task.origin_detail) issues.push('no_origin');
  }
  return issues;
}

/**
 * @param {Object} props
 * @param {any=} props.tasks
 * @param {any=} props.onOpenTask
 */
export default function PendingStructureTab({ tasks, onOpenTask }) {
  const problemTasks = useMemo(() => {
    return tasks
      .filter(t => t.status !== 'cancelled')
      .map(t => ({ ...t, issues: getIssues(t) }))
      .filter(t => t.issues.length > 0)
      .sort((a, b) => b.issues.length - a.issues.length);
  }, [tasks]);

  const issueCount = useMemo(() => {
    const counts = {};
    problemTasks.forEach(t => t.issues.forEach(i => { counts[i] = (counts[i] || 0) + 1; }));
    return counts;
  }, [problemTasks]);

  if (problemTasks.length === 0) {
    return (
      <div className="text-center py-16 text-emerald-600">
        <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-60" />
        <p className="text-sm font-semibold">Todas as tarefas estão bem estruturadas!</p>
        <p className="text-xs mt-1 text-slate-400">Nenhuma pendência de estruturação identificada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary header */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <span className="text-sm font-bold text-amber-800">{problemTasks.length} tarefa{problemTasks.length !== 1 ? 's' : ''} com pendências</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(issueCount).map(([key, count]) => {
            const cfg = ISSUE_CONFIGS[key];
            if (!cfg) return null;
            return (
              <span key={key} className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border font-semibold ${cfg.color}`}>
                <cfg.icon className="w-3 h-3" />
                {cfg.label} ({count})
              </span>
            );
          })}
        </div>
      </div>

      {/* Task list */}
      <div className="space-y-3">
        {problemTasks.map(task => {
          const p = PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.medium;
          const s = STATUS_STYLE[task.status] || STATUS_STYLE.todo;
          return (
            <div
              key={task.id}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer"
              onClick={() => onOpenTask(task)}
            >
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 leading-snug">{task.title || '(Sem título)'}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {task.dimension_key && (
                        <span className="text-[10px] text-slate-400">{DIM_LABELS[task.dimension_key] || task.dimension_key}</span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${p.badge}`}>{p.label}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-xs font-bold text-amber-600">{task.issues.length}</span>
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <ArrowRight className="w-4 h-4 text-slate-300" />
                  </div>
                </div>
              </div>

              <div className="px-4 py-2.5 bg-slate-50">
                <div className="flex flex-wrap gap-1.5">
                  {task.issues.map(issueKey => {
                    const cfg = ISSUE_CONFIGS[issueKey];
                    if (!cfg) return null;
                    return (
                      <span key={issueKey} className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium ${cfg.color}`}>
                        <cfg.icon className="w-2.5 h-2.5" />
                        {cfg.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}