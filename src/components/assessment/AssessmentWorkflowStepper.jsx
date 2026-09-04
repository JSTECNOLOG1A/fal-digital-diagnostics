import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  CheckCircle2, Loader2, ClipboardList,
  Activity, BarChart3, AlertCircle, GitBranch, Layers,
  Rocket, FileText, Network, RefreshCw, Zap,
  TrendingUp, Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';

import PhaseCard from './flowchart/PhaseCard';
import { HorizontalArrow, VerticalConnector } from './flowchart/FlowConnector';
import LockedPhasePanel from './flowchart/LockedPhasePanel';
import PhaseOneContent from './flowchart/PhaseOneContent';
import PhaseTwoContent from './flowchart/PhaseTwoContent';
import PhaseThreeContent from './flowchart/PhaseThreeContent';

// ── Configuração das fases ────────────────────────────────────────────────────
const PHASES_CONFIG = [
  {
    key: 'entrada',
    number: '01',
    title: 'Coleta & Qualidade',
    subtitle: 'Base diagnóstica',
    color: 'navy',
    icon: ClipboardList,
  },
  {
    key: 'analise',
    number: '02',
    title: 'Diagnóstico 8D™',
    subtitle: 'Estratégia diagnóstica',
    color: 'blue',
    icon: Target,
  },
  {
    key: 'saida',
    number: '03',
    title: 'Execução & Impacto',
    subtitle: 'Entrega de valor',
    color: 'green',
    icon: TrendingUp,
  },
];

const WORKFLOW_STEPS = [
  { id: 'diagnostico', label: 'Questionário',  icon: ClipboardList, flowKey: null,          phase: 'entrada', requiresDone: [] },
  { id: 'mqe',         label: 'MQE™',          icon: Network,       flowKey: null,          phase: 'entrada', requiresDone: [] },
  { id: 'radar',       label: 'Radar 8D™',     icon: Activity,      flowKey: 'diagnostic',  phase: 'analise', requiresDone: ['diagnostic'] },
  { id: 'resultados',  label: 'IFME™',         icon: BarChart3,     flowKey: 'diagnostic',  phase: 'analise', requiresDone: ['diagnostic'] },
  { id: 'prioridades', label: 'Prioridades',   icon: AlertCircle,   flowKey: 'priorities',  phase: 'analise', requiresDone: ['priorities'] },
  { id: 'inteligencia',label: 'Inteligência',  icon: GitBranch,     flowKey: 'intelligence',phase: 'analise', requiresDone: ['intelligence'] },
  { id: 'analise',     label: 'MFIS™',         icon: Layers,        flowKey: null,          phase: 'analise', requiresDone: ['diagnostic'] },
  { id: 'plano-acao',  label: 'Plano de Ação', icon: Rocket,        flowKey: 'action_plan', phase: 'saida',   requiresDone: ['intelligence'] },
  { id: 'relatorios',  label: 'Relatórios',    icon: FileText,      flowKey: 'report',      phase: 'saida',   requiresDone: ['diagnostic'] },
];

function getLastRunAt(steps) {
  if (!steps) return null;
  const dates = Object.values(steps)
    .map(s => s?.generated_at).filter(Boolean)
    .map(d => new Date(d).getTime()).filter(t => !isNaN(t));
  if (!dates.length) return null;
  return new Date(Math.max(...dates));
}

// ── Badge de status refinado ──────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.type
  * @param {any=} props.questionnaireComplete
  * @param {any=} props.mqeComplete
  * @param {any=} props.onNavigate
  * @param {any=} props.onRun
  * @param {any=} props.assessment
  * @param {any=} props.linkedEntities
  * @param {any=} props.selectedEntity
  * @param {any=} props.onSelectEntity
  * @param {any=} props.buildQuestionnaireUrl
  * @param {any=} props.isMultiEntity
  * @param {any=} props.hasValidQuestionSet
  * @param {any=} props.crossings
 */
function StatusPill({ type }) {
  if (type === 'stale') return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 shadow-sm">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
      Dados desatualizados
    </span>
  );
  if (type === 'error') return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 shadow-sm">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
      Erro no pipeline
    </span>
  );
  if (type === 'done') return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 shadow-sm">
      <CheckCircle2 className="h-3 w-3" />
      Pipeline completo
    </span>
  );
  if (type === 'running') return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 shadow-sm">
      <Loader2 className="h-3 w-3 animate-spin" />
      Processando...
    </span>
  );
  return null;
}

// ── Componente principal ──────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.activeTab
 * @param {any=} props.steps
 * @param {any=} props.flowState
 * @param {any=} props.responseVersion
 * @param {any=} props.loading
 * @param {any=} props.running
 * @param {any=} props.pipelineProgress
  * @param {any=} props.questionnaireComplete
  * @param {any=} props.mqeComplete
  * @param {any=} props.onNavigate
  * @param {any=} props.onRun
  * @param {any=} props.assessment
  * @param {any=} props.linkedEntities
  * @param {any=} props.selectedEntity
  * @param {any=} props.onSelectEntity
  * @param {any=} props.buildQuestionnaireUrl
  * @param {any=} props.isMultiEntity
  * @param {any=} props.hasValidQuestionSet
  * @param {any=} props.crossings
 */
export default function AssessmentWorkflowStepper({
  activeTab,
  steps,
  flowState,
  responseVersion,
  loading,
  running,
  pipelineProgress = {},
  questionnaireComplete = false,
  mqeComplete = false,
  onNavigate,
  onRun,
  // Props para fluxograma multi-entidade
  assessment,
  linkedEntities = [],
  selectedEntity,
  onSelectEntity,
  buildQuestionnaireUrl,
  isMultiEntity = false,
  hasValidQuestionSet = false,
  crossings = [],
}) {
  // CrossingQuestionnaire navega de volta pra cá passando state:{tab:'mqe'}
  // pra reabrir direto na aba MQE (em vez de sempre cair no Questionário).
  const location = useLocation();
  const [activeModule, setActiveModule] = useState(location.state?.tab === 'mqe' ? 'mqe' : 'questionario');
  // Fase expandida: null = todas recolhidas, 'entrada'|'analise'|'saida' = aberta
  const [expandedPhase, setExpandedPhase] = useState('entrada');

  // Sincroniza a fase expandida com a aba ativa navegada
  React.useEffect(() => {
    const currentStep = WORKFLOW_STEPS.find(s => s.id === activeTab);
    if (currentStep) setExpandedPhase(currentStep.phase);
  }, [activeTab]);

  const togglePhase = (phaseKey) => {
    setExpandedPhase(prev => prev === phaseKey ? null : phaseKey);
  };

  function getStepState(step) {
    const isActive = step.id === activeTab;
    const isUnlocked = step.requiresDone.length === 0 ||
      step.requiresDone.every(key => steps?.[key]?.status === 'done');
    if (!isUnlocked) return isActive ? 'active' : 'locked';
    if (isActive) return 'active';
    if (step.id === 'diagnostico') return questionnaireComplete ? 'done' : 'pending';
    if (step.id === 'mqe')         return mqeComplete           ? 'done' : 'pending';
    const pipeKey = step.flowKey;
    if (pipeKey && pipelineProgress[pipeKey]) {
      const pp = pipelineProgress[pipeKey];
      if (pp === 'running') return 'running';
      if (pp === 'error')   return 'error';
    }
    if (pipeKey && steps?.[pipeKey]) {
      const s = steps[pipeKey].status;
      if (s === 'done')    return 'done';
      if (s === 'stale')   return 'stale';
      if (s === 'error')   return 'error';
      if (s === 'running') return 'running';
    }
    return 'pending';
  }

  function isPhaseDone(phaseKey) {
    return WORKFLOW_STEPS.filter(s => s.phase === phaseKey).every(s => getStepState(s) === 'done');
  }

  const hasStale   = steps && Object.values(steps).some(s => s.status === 'stale');
  const hasError   = steps && Object.values(steps).some(s => s.status === 'error');
  const anyActive  = steps && Object.values(steps).some(s => s.status !== 'not_started');
  const allDone    = steps && ['diagnostic','priorities','intelligence'].every(k => steps[k]?.status === 'done');
  const lastAt     = getLastRunAt(steps);

  const statusType = running ? 'running' : hasError ? 'error' : hasStale ? 'stale' : allDone && anyActive ? 'done' : null;

  // Lógica de desbloqueio visual das fases 02 e 03
  // Fase 02: libera toda de uma vez quando Fase 01 estiver concluída (questionário + MQE)
  const phase01Done = questionnaireComplete && mqeComplete;
  const phase02Done = isPhaseDone('analise');
  const phase02Locked = !phase01Done;
  // Fase 03: só libera quando o pipeline analítico completo estiver done
  const phase03Locked = !allDone;

  // Controle do CTA de update
  let ctaLabel = null;
  let ctaClass = '';
  if (!running && anyActive) {
    if (hasError) { ctaLabel = 'Retomar pipeline'; ctaClass = 'border-red-300 text-red-700 hover:bg-red-50'; }
    else if (hasStale) { ctaLabel = 'Atualizar análise'; ctaClass = 'border-amber-300 text-amber-700 hover:bg-amber-50'; }
  }

  // Wrapper border baseado no estado
  const wrapperBorder = running
    ? 'border-blue-200/80 bg-gradient-to-br from-blue-50/30 via-white to-white'
    : hasError
    ? 'border-red-200/80 bg-gradient-to-br from-red-50/20 via-white to-white'
    : hasStale
    ? 'border-amber-200/80 bg-gradient-to-br from-amber-50/35 via-white to-white'
    : allDone && anyActive
    ? 'border-emerald-200/80 bg-gradient-to-br from-emerald-50/20 via-white to-white'
    : 'border-slate-200 bg-white';

  if (loading) return null;

  const showFlowchart = isMultiEntity && hasValidQuestionSet;

  return (
    <div className={`relative rounded-2xl border shadow-[0_18px_45px_rgba(15,23,42,0.05)] px-5 pt-4 pb-5 mb-5 transition-colors overflow-hidden ${wrapperBorder}`}>

      {/* Padrão de fundo sutil */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.28] bg-[radial-gradient(circle_at_20%_15%,rgba(251,191,36,0.10),transparent_30%),radial-gradient(circle_at_90%_10%,rgba(37,99,235,0.06),transparent_25%)]" />

      <div className="relative z-10">
        {/* ── Barra superior ── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
              {running ? 'Pipeline em execução...' : 'Programa de Consultoria'}
            </span>
            {running && <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />}
            {responseVersion > 0 && !running && (
              <span className="text-[10px] text-slate-400">v<span className="font-semibold text-slate-500">{responseVersion}</span></span>
            )}
            {statusType && <StatusPill type={statusType} />}
          </div>

          <div className="flex items-center gap-3">
            {lastAt && !running && (
              <span className="text-[10px] text-slate-400 hidden md:block">
                Última análise:{' '}
                <span className="font-medium text-slate-500">
                  {lastAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </span>
                {' · '}
                <span className="italic">{formatDistanceToNow(lastAt, { locale: ptBR, addSuffix: true })}</span>
              </span>
            )}
            {ctaLabel && onRun && (
              <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRun}
                  className={`group text-xs gap-1.5 h-8 px-3 backdrop-blur transition-all duration-200 hover:shadow-md ${ctaClass}`}
                >
                  {hasError
                    ? <Zap className="w-3 h-3" />
                    : <RefreshCw className="w-3 h-3 transition-transform duration-300 group-hover:rotate-180" />
                  }
                  {ctaLabel}
                </Button>
              </motion.div>
            )}
          </div>
        </div>

        {/* ── Grid de fases — cabeçalhos clicáveis ── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_36px_1fr_36px_1fr] gap-2 items-center">
          {PHASES_CONFIG.map((phase, i) => (
            <React.Fragment key={phase.key}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.08 }}
                onClick={() => togglePhase(phase.key)}
                className="cursor-pointer"
              >
                <PhaseCard
                  number={phase.number}
                  title={phase.title}
                  subtitle={phase.subtitle}
                  color={phase.color}
                  icon={phase.icon}
                  done={isPhaseDone(phase.key)}
                  active={expandedPhase === phase.key}
                  expanded={expandedPhase === phase.key}
                />
              </motion.div>
              {i < PHASES_CONFIG.length - 1 && (
                <HorizontalArrow active={i === 0 ? !phase02Locked : !phase03Locked} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ── Grid de conteúdo das fases (colapsável) ── */}
        <motion.div
          animate={{ height: expandedPhase ? 'auto' : 0, opacity: expandedPhase ? 1 : 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          style={{ overflow: 'hidden' }}
        >
          <div className="mt-1 grid grid-cols-1 xl:grid-cols-3 gap-4">

            {/* Coluna 01 — Coleta & Qualidade */}
            <div className={`flex flex-col transition-opacity duration-200 ${expandedPhase === 'entrada' ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              <div className="flex justify-center py-2">
                <VerticalConnector color="navy" />
              </div>

              {showFlowchart ? (
                <PhaseOneContent
                  assessment={assessment}
                  linkedEntities={linkedEntities}
                  selectedEntity={selectedEntity}
                  onSelectEntity={onSelectEntity}
                  buildQuestionnaireUrl={buildQuestionnaireUrl}
                  activeModule={activeModule}
                  onModuleChange={setActiveModule}
                  crossings={crossings}
                />
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 text-center min-h-[120px] flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <ClipboardList className="w-8 h-8 opacity-30" />
                    <p className="text-xs">Questionário e MQE™</p>
                  </div>
                </div>
              )}
            </div>

            {/* Coluna 02 — Diagnóstico 8D™ */}
            <div className={`flex flex-col transition-opacity duration-200 ${expandedPhase === 'analise' ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              <div className="flex justify-center py-2">
                <VerticalConnector color="blue" />
              </div>
              {phase02Locked ? (
                <LockedPhasePanel color="blue" message="Conclua o Questionário e o MQE™ para habilitar o Diagnóstico 8D™" />
              ) : (
                <PhaseTwoContent steps={steps} onNavigate={onNavigate} running={running} />
              )}
            </div>

            {/* Coluna 03 — Execução & Impacto */}
            <div className={`flex flex-col transition-opacity duration-200 ${expandedPhase === 'saida' ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              <div className="flex justify-center py-2">
                <VerticalConnector color="green" />
              </div>
              {phase03Locked ? (
                <LockedPhasePanel color="green" message="Conclua todo o Diagnóstico 8D™ para habilitar a Execução & Impacto" />
              ) : (
                <PhaseThreeContent steps={steps} onNavigate={onNavigate} />
              )}
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}