import React from 'react';
import { CheckCircle2, AlertTriangle, Clock, Loader2, XCircle, Zap, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STEPS = [
  { key: 'diagnostic',   label: 'IFME™' },
  { key: 'priorities',   label: 'Prioridades' },
  { key: 'execution',    label: 'Execução' },
  { key: 'intelligence', label: 'Inteligência' },
  { key: 'action_plan',  label: 'Plano de Ação' },
  { key: 'simulation',   label: 'Simulação' },
  { key: 'report',       label: 'Relatório' },
];

/**
 * @param {Object} props
 * @param {any=} props.status
 */
function StepDot({ status }) {
  if (status === 'done')
    return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />;
  if (status === 'running')
    return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin flex-shrink-0" />;
  if (status === 'stale')
    return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />;
  if (status === 'error')
    return <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />;
  return <Clock className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />;
}

function stepTextClass(status) {
  if (status === 'done')    return 'text-emerald-700';
  if (status === 'running') return 'text-blue-600';
  if (status === 'stale')   return 'text-amber-600';
  if (status === 'error')   return 'text-red-600';
  return 'text-slate-400';
}

/** Returns the most recent generated_at across all done steps */
function getLastRunAt(steps) {
  const dates = STEPS
    .map(s => steps[s.key]?.generated_at)
    .filter(Boolean)
    .map(d => new Date(d))
    .filter(d => !isNaN(d));
  if (!dates.length) return null;
  return new Date(Math.max(...dates));
}

/**
 * @param {Object} props
 * @param {any=} props.steps
 */
function LastRunLabel({ steps }) {
  const lastAt = getLastRunAt(steps);
  if (!lastAt) return null;
  return (
    <span className="text-[10px] text-slate-400">
      Última análise:{' '}
      <span className="font-medium text-slate-500">
        {lastAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
        {' — '}
        {lastAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </span>
      {' · '}
      <span className="italic">
        {formatDistanceToNow(lastAt, { locale: ptBR, addSuffix: true })}
      </span>
    </span>
  );
}

/**
 * FlowStatusPanel
 * ────────────────────────────────────────────────────────────────────
 * Compact banner showing pipeline state at a glance.
 * Always visible (even during execution — shows spinner variant).
 *
 * Props:
 *   steps            — flow.steps from useAssessmentFlow
 *   responseVersion  — flow.response_version
 *   loading          — flow.loading
 *   running          — true while pipeline is executing (passed from parent)
 *   onRun            — fn() to trigger / resume pipeline
 *   lastErrorStep    — flow.flowState?.last_error_step
 */
export default function FlowStatusPanel({ steps, responseVersion, loading, running, onRun, lastErrorStep }) {
  if (loading) return null;
  if (!steps) return null;

  // Only show if at least one step has been touched
  const anyActive = Object.values(steps).some(s => s.status !== 'not_started');
  if (!anyActive && !running) return null;

  const hasStale = Object.values(steps).some(s => s.status === 'stale');
  const hasError = Object.values(steps).some(s => s.status === 'error');
  const anyRunning = running || Object.values(steps).some(s => s.status === 'running');
  const allDone  = STEPS.every(s => steps[s.key]?.status === 'done');

  // Border/bg based on global state
  const borderClass = anyRunning
    ? 'border-blue-200 bg-blue-50/60'
    : hasError
    ? 'border-red-200 bg-red-50'
    : hasStale
    ? 'border-amber-200 bg-amber-50/60'
    : allDone
    ? 'border-emerald-200 bg-emerald-50/60'
    : 'border-slate-200 bg-slate-50';

  // CTA contextual
  let ctaLabel = null;
  let ctaVariant = 'outline';
  let ctaIcon = null;
  let ctaMessage = null;

  if (!anyRunning) {
    if (hasError) {
      ctaMessage = `Erro na etapa ${lastErrorStep || ''}`;
      ctaLabel = 'Retomar pipeline';
      ctaIcon = <Zap className="w-3 h-3" />;
      ctaVariant = 'outline';
    } else if (hasStale) {
      ctaMessage = 'Respostas atualizadas após última análise';
      ctaLabel = 'Atualizar análise';
      ctaIcon = <RefreshCw className="w-3 h-3" />;
      ctaVariant = 'outline';
    }
  }

  return (
    <div className={`rounded-xl border px-4 py-3 mb-5 ${borderClass}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">

        {/* Left: label + version + last run */}
        <div className="flex-shrink-0 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide leading-none">
              {anyRunning ? 'Pipeline em execução...' : 'Status do Pipeline'}
            </p>
            {anyRunning && <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />}
            {responseVersion > 0 && !anyRunning && (
              <span className="text-[10px] text-slate-400">
                v<span className="font-semibold text-slate-500">{responseVersion}</span>
              </span>
            )}
          </div>
          <LastRunLabel steps={steps} />
        </div>

        {/* Divider (desktop) */}
        <div className="hidden sm:block w-px h-8 bg-slate-200 flex-shrink-0" />

        {/* Steps */}
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 flex-1">
          {STEPS.map(s => {
            const status = steps[s.key]?.status || 'not_started';
            return (
              <div key={s.key} className="flex items-center gap-1.5">
                <StepDot status={status} />
                <span className={`text-xs font-medium ${stepTextClass(status)}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Right: global status tag + CTA */}
        <div className="sm:ml-auto flex-shrink-0 flex items-center gap-2">
          {/* Status tag */}
          {!anyRunning && (
            <>
              {hasError && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                  Erro no pipeline
                </span>
              )}
              {!hasError && hasStale && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  Dados desatualizados
                </span>
              )}
              {!hasError && !hasStale && allDone && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  Pipeline completo ✓
                </span>
              )}
            </>
          )}

          {/* CTA button */}
          {ctaLabel && onRun && (
            <div className="flex items-center gap-2">
              {ctaMessage && (
                <span className="text-[10px] text-slate-500 hidden md:inline">{ctaMessage}</span>
              )}
              <Button
                size="sm"
                variant={ctaVariant}
                onClick={onRun}
                className={`text-xs gap-1.5 h-7 px-2.5 ${
                  hasError
                    ? 'border-red-300 text-red-700 hover:bg-red-50'
                    : 'border-amber-300 text-amber-700 hover:bg-amber-50'
                }`}
              >
                {ctaIcon}
                {ctaLabel}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}