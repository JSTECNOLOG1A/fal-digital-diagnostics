/**
 * ActionPlanExecutivePanel
 * Painel executivo enxuto — 4 indicadores + próxima ação + dimensão crítica
 */
import React from 'react';
import { AlertTriangle, Lock, Zap, CheckCircle2, ArrowRight, Layers, Wrench } from 'lucide-react';

const DIM_LABELS = {
  governanca: 'Governança', juridico: 'Jurídico', controles_internos: 'Controles Internos',
  financeiro: 'Financeiro', contabil: 'Contábil', tributario: 'Fiscal',
  operacional: 'Operacional', sistemas: 'Tecnologia',
};

/**
 * @param {Object} props
 * @param {any=} props.tasks
 * @param {any=} props.onOpenTask
 */
export default function ActionPlanExecutivePanel({ tasks = [], onOpenTask }) {
  const active = tasks.filter(t => t.status !== 'cancelled');

  const critical    = active.filter(t => t.priority === 'critical' && t.status !== 'done');
  const blocked     = active.filter(t => t.is_blocked && t.status !== 'done');
  const quickWins   = active.filter(t => t.action_type === 'quick_win' && t.status !== 'done');
  const done        = active.filter(t => t.status === 'done');

  // Próxima ação mais prioritária (critical > high, não bloqueada, não done)
  const nextAction = active
    .filter(t => t.status !== 'done' && !t.is_blocked)
    .sort((a, b) => {
      const ord = { critical: 0, high: 1, medium: 2, low: 3 };
      return (ord[a.priority] ?? 4) - (ord[b.priority] ?? 4);
    })[0] || null;

  // Dimensão com maior concentração de tarefas pendentes
  const dimCount = {};
  active.filter(t => t.status !== 'done' && t.dimension_key).forEach(t => {
    dimCount[t.dimension_key] = (dimCount[t.dimension_key] || 0) + 1;
  });
  const topDim = Object.entries(dimCount).sort((a, b) => b[1] - a[1])[0] || null;

  const stats = [
    {
      label: 'Críticas pendentes',
      value: critical.length,
      icon: AlertTriangle,
      color: critical.length > 0 ? 'text-red-600' : 'text-slate-400',
      bg: critical.length > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200',
    },
    {
      label: 'Bloqueadas',
      value: blocked.length,
      icon: Lock,
      color: blocked.length > 0 ? 'text-amber-600' : 'text-slate-400',
      bg: blocked.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200',
    },
    {
      label: 'Quick wins',
      value: quickWins.length,
      icon: Zap,
      color: quickWins.length > 0 ? 'text-blue-600' : 'text-slate-400',
      bg: quickWins.length > 0 ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200',
    },
    {
      label: 'Concluídas',
      value: done.length,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 border-emerald-200',
    },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-4">
      {/* 4 indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className={`flex items-center gap-3 p-3 rounded-lg border ${s.bg}`}>
            <s.icon className={`w-5 h-5 flex-shrink-0 ${s.color}`} />
            <div>
              <p className={`text-xl font-bold leading-none ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Split estratégico / operacional */}
      {(() => {
        const strategic   = active.filter(t => t.task_layer !== 'operational');
        const operational = active.filter(t => t.task_layer === 'operational');
        if (operational.length === 0) return null;
        return (
          <div className="flex gap-3 pt-1 border-t border-slate-100">
            <span className="flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 rounded-full px-3 py-1">
              <Layers className="w-3 h-3" />{strategic.length} estratégicas
            </span>
            <span className="flex items-center gap-1.5 text-xs text-violet-600 bg-violet-50 rounded-full px-3 py-1">
              <Wrench className="w-3 h-3" />{operational.length} operacionais (por pergunta)
            </span>
          </div>
        );
      })()}

      {/* Linha secundária */}
      {(nextAction || topDim) && (
        <div className="flex flex-wrap gap-3 pt-1 border-t border-slate-100">
          {nextAction && (
            <button
              onClick={() => onOpenTask && onOpenTask(nextAction)}
              className="flex items-center gap-2 text-xs text-slate-600 hover:text-blue-600 transition-colors group"
            >
              <span className="font-semibold text-slate-500">Próxima ação:</span>
              <span className="truncate max-w-[220px] group-hover:underline">{nextAction.title}</span>
              <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
            </button>
          )}
          {topDim && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="font-semibold">Dimensão mais crítica:</span>
              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                {DIM_LABELS[topDim[0]] || topDim[0]} · {topDim[1]} pendentes
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}