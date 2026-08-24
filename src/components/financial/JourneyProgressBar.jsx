/**
 * JourneyProgressBar — Jornada progressiva interativa (navegação real).
 *
 * ESTRUTURA → FONTES → CONSOLIDAÇÃO → VALIDAÇÃO → ANÁLISE  (multi-entidade)
 * FONTES → ANÁLISE  (individual)
 *
 * Props:
 *   steps       — array de { key, label, icon, status, detail, accessible } (da useDiagnosisJourney)
 *   activeStep  — key do step atualmente ativo
 *   onStepClick — callback(stepKey) quando o usuário clica num step acessível
 */
import React from 'react';
import { CheckCircle2, Lock, Building2, Upload, GitBranch, ShieldCheck, BarChart3, FileText, Layers, Sparkles } from 'lucide-react';

const ICONS = {
  Building2,
  Upload,
  GitBranch,
  ShieldCheck,
  BarChart3,
  FileText,
  Layers,
  Sparkles,
};

const STEP_KEY_ICONS = {
  estrutura: 'Building2',
  fontes: 'Upload',
  combinacao: 'Layers',
  conciliacao: 'GitBranch',
  cedula: 'FileText',
  preparacao: 'Sparkles',
  validacao: 'ShieldCheck',
  analise: 'BarChart3',
  consolidacao: 'GitBranch',
};

const STATUS_CFG = {
  done: {
    ring: 'bg-emerald-500 text-white',
    label: 'text-emerald-700',
    detail: 'text-emerald-600',
    statusText: '✓ concluída',
    cursor: 'cursor-pointer hover:ring-2 hover:ring-emerald-300',
  },
  current: {
    ring: 'bg-blue-600 text-white',
    label: 'text-blue-700',
    detail: 'text-blue-600',
    statusText: 'em andamento',
    cursor: 'cursor-pointer ring-2 ring-blue-300',
  },
  blocked: {
    ring: 'bg-red-100 text-red-400',
    label: 'text-red-400',
    detail: 'text-red-400',
    statusText: 'bloqueada',
    cursor: 'cursor-not-allowed',
  },
  pending: {
    ring: 'bg-slate-200 text-slate-400',
    label: 'text-slate-400',
    detail: 'text-slate-400',
    statusText: 'pendente',
    cursor: 'cursor-not-allowed',
  },
};

/**
 * @param {Object} props
 * @param {any=} props.steps
 * @param {any=} props.activeStep
 * @param {any=} props.onStepClick
 * @param {any=} props.analysisType
 */
export default function JourneyProgressBar({ steps = [], activeStep, onStepClick, analysisType }) {
  if (!steps.length) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <GitBranch className="w-4 h-4 text-blue-500" />
        <p className="text-sm font-bold text-slate-700">Jornada do Diagnóstico</p>
        {analysisType && analysisType !== 'individual' && (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100 text-purple-600 capitalize">
            {analysisType}
          </span>
        )}
      </div>
      <div className="flex items-start gap-1 flex-wrap">
        {steps.map((s, i) => {
          const cfg = STATUS_CFG[s.status] || STATUS_CFG.pending;
          const Icon = ICONS[STEP_KEY_ICONS[s.key] || 'BarChart3'] || BarChart3;
          const isActive = activeStep === s.key;
          const clickable = s.accessible && onStepClick;

          return (
            <React.Fragment key={s.key}>
              <button
                onClick={() => clickable && onStepClick(s.key)}
                disabled={!clickable}
                className={`flex-1 min-w-[120px] text-left transition-all rounded-lg p-2 ${cfg.cursor} ${
                  isActive ? 'bg-blue-50 border border-blue-200' : 'border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.ring}`}>
                    {s.status === 'done' ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : s.status === 'blocked' ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-bold ${cfg.label} ${isActive ? 'text-blue-700' : ''}`}>
                      {i + 1}. {s.label}
                    </p>
                    <p className={`text-[11px] ${cfg.detail} truncate`}>
                      {s.detail || cfg.statusText}
                    </p>
                  </div>
                </div>
              </button>
              {i < steps.length - 1 && (
                <div className="text-slate-300 self-center pt-3 text-sm">→</div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}