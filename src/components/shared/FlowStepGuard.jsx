/**
 * FlowStepGuard
 * =====================================================================
 * Wraps each post-diagnostic tab.
 * Reads step status from useAssessmentFlow and renders the correct UI state.
 *
 * Status → UI mapping:
 *   not_started  → CTA to run the step (or run upstream first)
 *   running      → spinner
 *   done         → children (results)
 *   stale        → children + stale banner
 *   error        → error + retry
 *
 * Usage:
 *   <FlowStepGuard step={flow.steps.priorities} stepKey="priorities" onRun={handleRunAnalysis}>
 *     <FalPriorityPanel ... />
 *   </FlowStepGuard>
 * =====================================================================
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, Lock, RefreshCw } from 'lucide-react';

const STEP_LABELS = {
  diagnostic:   'Diagnóstico',
  priorities:   'Prioridades Estratégicas',
  intelligence: 'Diagnóstico Inteligente',
  action_plan:  'Plano de Ação',
  simulation:   'Simulação de Impacto',
  report:       'Relatório PDF',
};

const DEP_LABELS = {
  diagnostic:   null,
  priorities:   'diagnóstico',
  intelligence: 'prioridades',
  action_plan:  'diagnóstico inteligente',
  simulation:   'plano de ação',
  report:       'plano de ação',
};

/**
 * @param {Object} props
 * @param {any=} props.step
 * @param {any=} props.stepKey
 * @param {any=} props.onRun
 * @param {any=} props.running
 * @param {any=} props.children
 */
export default function FlowStepGuard({ step, stepKey, onRun, running, children }) {
  if (!step) return null;

  const { status, stale, can_run, message, generated_at } = step;

  // ── RUNNING ──────────────────────────────────────────────────────────────
  if (status === 'running' || running) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
        <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
        <p className="text-sm font-medium">Processando {STEP_LABELS[stepKey] || stepKey}...</p>
      </div>
    );
  }

  // ── NOT STARTED — cannot run yet (dependency missing) ────────────────────
  if (status === 'not_started' && !can_run) {
    const dep = DEP_LABELS[stepKey];
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-slate-400">
        <Lock className="w-8 h-8 opacity-30" />
        <p className="text-sm font-medium text-center">
          {STEP_LABELS[stepKey] || stepKey} não disponível
        </p>
        <p className="text-xs text-center text-slate-400 max-w-xs">
          {dep
            ? `Esta etapa requer que o "${dep}" seja concluído primeiro.`
            : message || 'Complete as etapas anteriores primeiro.'}
        </p>
      </div>
    );
  }

  // ── NOT STARTED — can run: show children (panel has its own compute button) ──
  if (status === 'not_started' && can_run) {
    return <div>{children}</div>;
  }

  // ── ERROR ─────────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl max-w-md w-full">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700 mb-1">Erro na etapa: {STEP_LABELS[stepKey]}</p>
              <p className="text-xs text-red-600">{message || 'Erro desconhecido.'}</p>
            </div>
          </div>
          {onRun && (
            <Button size="sm" onClick={onRun} variant="outline" className="mt-3 gap-2 border-red-300 text-red-600">
              <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── DONE or STALE — show results ─────────────────────────────────────────
  return (
    <div>
      {stale && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-sm text-amber-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
          <div className="flex-1">
            <span className="font-semibold">Resultados desatualizados.</span>
            {generated_at && (
              <span className="text-xs text-amber-600 ml-1">
                Gerado em {new Date(generated_at).toLocaleString('pt-BR')}.
              </span>
            )}
            <span className="block text-xs mt-0.5">
              Novas respostas foram registradas após esta análise. Execute novamente para atualizar.
            </span>
          </div>
          {onRun && (
            <Button size="sm" variant="outline" onClick={onRun} className="flex-shrink-0 gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-100">
              <RefreshCw className="w-3 h-3" /> Atualizar
            </Button>
          )}
        </div>
      )}
      {children}
    </div>
  );
}