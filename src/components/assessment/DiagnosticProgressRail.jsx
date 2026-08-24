import React from 'react';
import { CheckCircle2, Lock, AlertTriangle } from 'lucide-react';

const STEPS = [
  { id: 'diagnostico',  label: 'Questionário',       flowKey: null },
  { id: 'resultados',   label: 'IFME™',              flowKey: 'diagnostic' },
  { id: 'prioridades',  label: 'Prioridades',        flowKey: 'priorities' },
  { id: 'inteligencia', label: 'Diag. Inteligente',  flowKey: 'intelligence' },
  { id: 'plano-acao',   label: 'Plano de Ação',      flowKey: 'action_plan' },
  { id: 'relatorio',    label: 'Relatório',          flowKey: 'report' },
];

/**
 * Props:
 *  activeTab   — string: current tab id
 *  steps       — object from useAssessmentFlow().steps (optional, falls back to legacy booleans)
 *  onNavigate  — fn(stepId)
 *
 * Legacy props (still supported):
 *  hasSnapshot, hasPriorities, hasIntelligence, hasActionPlan, hasReport
 */
export default function DiagnosticProgressRail({ activeTab, steps, onNavigate,
  hasSnapshot, hasPriorities, hasIntelligence, hasActionPlan, hasReport }) {

  function getStepStatus(step) {
    // New: read from flow steps
    if (steps && step.flowKey) {
      return steps[step.flowKey]?.status || 'not_started';
    }
    // Legacy fallback
    switch (step.id) {
      case 'resultados':   return hasSnapshot ? 'done' : 'not_started';
      case 'prioridades':  return hasPriorities ? 'done' : 'not_started';
      case 'inteligencia': return hasIntelligence ? 'done' : 'not_started';
      case 'plano-acao':   return hasActionPlan ? 'done' : 'not_started';
      case 'relatorio':    return hasReport ? 'done' : 'not_started';
      default: return 'not_started';
    }
  }

  function getState(step) {
    if (step.id === activeTab) return 'active';
    const flowStatus = getStepStatus(step);
    if (flowStatus === 'done') return 'done';
    if (flowStatus === 'stale') return 'stale';
    if (flowStatus === 'error') return 'error';
    if (flowStatus === 'running') return 'running';
    // locked: questionnaire is the only always-unlocked step
    if (step.id === 'diagnostico') return 'pending';
    if (!hasSnapshot && !steps?.diagnostic) return 'locked';
    return 'pending';
  }

  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3 mb-4">
      <div className="flex items-center justify-between overflow-x-auto gap-0 min-w-0">
        {STEPS.map((step, i) => {
          const state = getState(step);
          const isLast = i === STEPS.length - 1;
          const isClickable = state !== 'locked';
          const nextState = !isLast ? getState(STEPS[i + 1]) : null;
          const isConnectorDone = nextState === 'done';

          return (
            <div key={step.id} className="flex items-center gap-0">
              <button
                onClick={() => isClickable && onNavigate(step.id)}
                disabled={!isClickable}
                title={state === 'locked' ? 'Complete o diagnóstico primeiro' : step.label}
                className={`flex flex-col items-center gap-1 min-w-[72px] flex-1 px-1 transition-opacity
                  ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}
                `}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all flex-shrink-0
                  ${state === 'active'  ? 'bg-blue-600 border-blue-600 text-white scale-110 shadow-md shadow-blue-200' : ''}
                  ${state === 'done'    ? 'bg-emerald-500 border-emerald-500 text-white' : ''}
                  ${state === 'stale'   ? 'bg-amber-400 border-amber-400 text-white' : ''}
                  ${state === 'error'   ? 'bg-red-500 border-red-500 text-white' : ''}
                  ${state === 'running' ? 'bg-blue-400 border-blue-400 text-white animate-pulse' : ''}
                  ${state === 'pending' ? 'bg-white border-slate-300 text-slate-400' : ''}
                  ${state === 'locked'  ? 'bg-slate-100 border-slate-200 text-slate-300' : ''}
                `}>
                  {state === 'done'
                    ? <CheckCircle2 className="w-3.5 h-3.5" />
                    : state === 'locked'
                    ? <Lock className="w-3 h-3" />
                    : state === 'stale' || state === 'error'
                    ? <AlertTriangle className="w-3 h-3" />
                    : <span className="text-[10px] font-bold">{i + 1}</span>
                  }
                </div>
                <span className={`text-[10px] font-medium text-center leading-tight whitespace-nowrap
                  ${state === 'active'  ? 'text-blue-600' : ''}
                  ${state === 'done'    ? 'text-emerald-600' : ''}
                  ${state === 'stale'   ? 'text-amber-600' : ''}
                  ${state === 'error'   ? 'text-red-500' : ''}
                  ${state === 'running' ? 'text-blue-500' : ''}
                  ${state === 'pending' ? 'text-slate-500' : ''}
                  ${state === 'locked'  ? 'text-slate-300' : ''}
                `}>
                  {step.label}
                </span>
              </button>

              {!isLast && (
                <div className={`h-0.5 flex-1 mx-1 rounded-full transition-colors flex-shrink
                  ${isConnectorDone ? 'bg-emerald-300' : state === 'stale' ? 'bg-amber-200' : 'bg-slate-200'}
                `} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}