/**
 * DiagnosisPipelineHeader — Cabeçalho horizontal com pipeline de etapas.
 *
 * Renderiza breadcrumb + título + status + pipeline numerado (1 → 2 → ... → N).
 * Estilo minimalista inspirado no wizard de criação (prints de referência).
 *
 * Props:
 *   steps             — array de { key, label, status, detail, accessible } (da useDiagnosisJourney)
 *   activeStep        — key do step atualmente ativo
 *   onStepClick       — callback(stepKey) quando o usuário clica num step acessível
 *   diagnosis         — objeto FinancialDiagnosis
 *   statusCfg         — { label, cls } do DIAGNOSIS_STATUS_CONFIG
 *   backLabel         — texto do botão voltar
 *   onBack            — callback do botão voltar
 *   analysisTypeBadge — { badge, cls } do ANALYSIS_TYPE_CONFIG
 */
import React, { useState } from 'react';
import { ChevronRight, ArrowLeft, RotateCcw, Loader2, MoreHorizontal, Archive, Trash2, ArrowRight } from 'lucide-react';

const NEXT_MOVEMENT_CTA = {
  estrutura: { label: 'Completar definição', target: 'estrutura' },
  fontes: { label: 'Importar período pendente', target: 'fontes' },
  combinacao: { label: 'Preparar combinação', target: 'combinacao' },
  conciliacao: { label: 'Revisar conciliação', target: 'conciliacao' },
  cedula: { label: 'Concluir cédula', target: 'cedula' },
  preparacao: { label: 'Preparar dataset consolidado', target: 'preparacao' },
  validacao: { label: 'Resolver inconsistências', target: 'validacao' },
  analise: { label: 'Abrir demonstrações', target: 'analise' },
};


const STEP_DISPLAY = {
  estrutura:    { label: 'Definição',             subtitle: 'Estrutura da análise' },
  fontes:       { label: 'Períodos e balancetes',  subtitle: 'Importação dos dados' },
  combinacao:   { label: 'Combinação',             subtitle: 'Preparação do dataset' },
  conciliacao:  { label: 'Conciliação',            subtitle: 'Conciliação intragrupo' },
  cedula:       { label: 'Cédula',                 subtitle: 'Eliminações e ajustes' },
  preparacao:   { label: 'Preparação',             subtitle: 'Dataset consolidado' },
  validacao:    { label: 'Validações',             subtitle: 'Conferência e ajustes' },
  analise:      { label: 'Demonstrações e indicadores', subtitle: 'Fechamento da análise financeira' },
};

/**
 * @param {Object} props
 * @param {Array<{key: string, label: string, status: string, detail: string, accessible: boolean}>=} props.steps
 * @param {string=} props.activeStep
 * @param {(key: string) => void=} props.onStepClick
 * @param {Object=} props.diagnosis
 * @param {{label: string, cls: string}=} props.statusCfg
 * @param {string=} props.backLabel
 * @param {() => void=} props.onBack
 * @param {{badge: string, cls: string}=} props.analysisTypeBadge
 * @param {() => void=} props.onReprocessar
 * @param {boolean=} props.reprocessing
 * @param {boolean=} props.canReprocessar
 * @param {() => void=} props.onArchive
 * @param {() => void=} props.onDelete
 * @param {boolean=} props.isArchived
 * @param {Object=} props.integrity
 * @param {string=} props.nextMovementLabel
 * @param {() => void=} props.onNextMovement
 */
export default function DiagnosisPipelineHeader({
  steps = [],
  activeStep,
  onStepClick,
  diagnosis,
  statusCfg,
  backLabel = 'Voltar',
  onBack,
  analysisTypeBadge,
  onReprocessar,
  reprocessing = false,
  canReprocessar = false,
  onArchive,
  onDelete,
  isArchived = false,
  integrity,
  nextMovementLabel,
  onNextMovement,
}) {
  const [showMenu, setShowMenu] = useState(false);
  if (!steps.length) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4">
      {/* Breadcrumb + título + status */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {backLabel}
          </button>
          <span className="text-slate-300 text-sm">/</span>
          <h1 className="text-base font-bold text-slate-800 truncate">{diagnosis?.title || '—'}</h1>
          {statusCfg && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap flex-shrink-0 ${statusCfg.cls}`}>
              {statusCfg.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {analysisTypeBadge && (
            <span className="text-[10px] bg-slate-700 text-white px-2 py-0.5 rounded font-bold tracking-wide whitespace-nowrap">
              {analysisTypeBadge.badge}
            </span>
          )}
          {integrity && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${
              integrity.status === 'blocked' ? 'bg-red-100 text-red-700 border border-red-200' :
              integrity.status === 'warning' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
              integrity.status === 'healthy' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
              'bg-slate-100 text-slate-500 border border-slate-200'
            }`} title={integrity.blocking_issues?.join('\n') || 'Integridade'}>
              {integrity.status === 'blocked' ? `${integrity.blocking_count} bloqueante(s)` :
               integrity.status === 'warning' ? `${integrity.warning_count} aviso(s)` :
               integrity.status === 'healthy' ? 'Íntegro' : '—'}
            </span>
          )}
          {nextMovementLabel && onNextMovement && (
            <button
              onClick={onNextMovement}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors"
              style={{ background: '#EFF6FF', borderColor: '#3B82F6', color: '#1D4ED8' }}
            >
              {nextMovementLabel}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          {canReprocessar && (
            <button
              onClick={onReprocessar}
              disabled={reprocessing}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors disabled:opacity-50"
              style={{ background: '#FEFBE8', borderColor: '#F59E0B', color: '#B45309' }}
            >
              {reprocessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              {reprocessing ? 'Reprocessando...' : 'Reprocessar'}
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="w-8 h-8 rounded-md border flex items-center justify-center transition-colors hover:bg-slate-100"
              style={{ background: '#F9FAFB', borderColor: '#D1D5DB' }}
              title="Mais ações"
            >
              <MoreHorizontal className="w-4 h-4" style={{ color: '#4B5563' }} />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-10 z-50 bg-white rounded-xl shadow-xl border border-slate-200 min-w-[200px] py-1 overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Zona de Risco</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Ações irreversíveis</p>
                  </div>
                  <button
                    onClick={() => { setShowMenu(false); onArchive?.(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 transition-colors"
                  >
                    <Archive className="w-4 h-4" />
                    {isArchived ? 'Desarquivar' : 'Arquivar Diagnóstico'}
                  </button>
                  <button
                    onClick={() => { setShowMenu(false); onDelete?.(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir Permanentemente
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Divisor */}
      <div className="border-t border-slate-100" />

      {/* Pipeline de etapas — círculos numerados com chevrons */}
      <div className="px-5 py-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          {steps.map((s, i) => {
            const display = STEP_DISPLAY[s.key] || { label: s.label, subtitle: s.detail || '' };
            const isActive = activeStep === s.key;
            const clickable = s.accessible && onStepClick;

            return (
              <React.Fragment key={s.key}>
                <button
                  onClick={() => clickable && onStepClick(s.key)}
                  disabled={!clickable}
                  className={`flex items-center gap-2.5 py-1.5 px-1.5 transition-all rounded-lg ${
                    clickable ? 'cursor-pointer' : 'cursor-default'
                  } ${!clickable ? 'opacity-50' : ''}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold border transition-all
                    ${isActive ? 'bg-[#1D4ED8] border-[#1D4ED8] text-white' : 'bg-white border-[#D1D5DB] text-[#9CA3AF]'}`}
                  >
                    {i + 1}
                  </div>
                  <div className="min-w-0 hidden sm:block">
                    <p
                      className={`text-sm font-bold whitespace-nowrap ${
                        isActive ? 'text-[#1D4ED8]' : 'text-[#374151]'
                      }`}
                    >
                      {display.label}
                    </p>
                    <p
                      className={`text-xs whitespace-nowrap ${
                        isActive ? 'text-[#1D4ED8]' : 'text-[#6B7280]'
                      }`}
                    >
                      {display.subtitle}
                    </p>
                  </div>
                </button>
                {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-[#D1D5DB] flex-shrink-0" />}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}