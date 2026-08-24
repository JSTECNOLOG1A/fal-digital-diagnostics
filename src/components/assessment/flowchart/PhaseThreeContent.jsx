import React from 'react';
import { motion } from 'framer-motion';
import { Rocket, FileText, CheckCircle2, AlertTriangle, ChevronRight } from 'lucide-react';
import PhaseIconGrid from './PhaseIconGrid';
import { SmallArrowDown } from './FlowConnector';

const STEPS = [
  { id: 'plano-acao', label: 'Plano de Ação', icon: Rocket,   flowKey: 'action_plan', tab: 'plano-acao' },
  { id: 'relatorios', label: 'Relatórios',    icon: FileText, flowKey: 'report',      tab: 'relatorios' },
];

function getStepStatus(step, steps) {
  const s = steps?.[step.flowKey]?.status;
  if (s === 'done')  return 'done';
  if (s === 'error') return 'error';
  return 'available';
}

const STATUS_CONFIG = {
  done:      { label: 'Concluído',  labelClass: 'text-emerald-500', icon: CheckCircle2,  iconClass: 'text-emerald-500' },
  error:     { label: 'Erro',       labelClass: 'text-red-500',     icon: AlertTriangle, iconClass: 'text-red-500' },
  available: { label: 'Disponível', labelClass: 'text-slate-400',   icon: null,          iconClass: '' },
};

/**
 * @param {Object} props
 * @param {any=} props.step
 * @param {any=} props.status
 * @param {any=} props.onClick
 * @param {any=} props.isLast
 */
function StepRow({ step, status, onClick, isLast }) {
  const Icon = step.icon;
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.available;
  const StateIcon = cfg.icon;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-slate-50 ${!isLast ? 'border-b border-slate-100' : ''}`}
    >
      <Icon className="w-[18px] h-[18px] text-slate-400 shrink-0" />
      <span className="flex-1 text-[13px] font-medium text-slate-700">{step.label}</span>
      <span className={`text-[12px] font-medium shrink-0 ${cfg.labelClass}`}>{cfg.label}</span>
      {StateIcon && <StateIcon className={`w-4 h-4 shrink-0 ${cfg.iconClass}`} />}
      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
    </button>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.steps
 * @param {any=} props.onNavigate
 */
export default function PhaseThreeContent({ steps, onNavigate }) {
  const stepsWithStatus = STEPS.map(s => ({ ...s, status: getStepStatus(s, steps) }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-0"
    >
      {/* Ícones grandes — mesmo padrão da Fase 1 */}
      <PhaseIconGrid steps={stepsWithStatus} color="green" onNavigate={onNavigate} />

      <SmallArrowDown color="emerald" />

      {/* Lista detalhada */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-1">
          {stepsWithStatus.map((step, i) => (
            <StepRow
              key={step.id}
              step={step}
              status={step.status}
              onClick={() => onNavigate?.(step.tab)}
              isLast={i === stepsWithStatus.length - 1}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}