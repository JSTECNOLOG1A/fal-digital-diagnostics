/**
 * FalJourneyBlock — Trilha FAL com 4 etapas visuais:
 * 1. Diagnóstico FAL
 * 2. Plano de Ação vinculado
 * 3. Revisões
 * 4. Relatório Executivo
 *
 * IMPORTANTE: Nenhum botão aponta para rotas legadas (AssessmentDetail?tab=plano-acao).
 * Revisões e plano usam /assessment/:id/action-plan.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import {
  BarChart3, Zap, GitBranch, ArrowRight, Plus, AlertCircle,
  FileText, ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';

const LEVEL_STYLE_INL = {
  Crítico:     { background: 'var(--fal-danger-bg)',  color: 'var(--fal-danger-text)' },
  Básico:      { background: 'var(--fal-warning-bg)', color: 'var(--fal-warning-text)' },
  Estruturado: { background: 'var(--fal-current-bg)', color: 'var(--fal-current-text)' },
  Avançado:    { background: 'var(--fal-success-bg)', color: 'var(--fal-success-text)' },
};

function StepConnector() {
  return (
    <div className="flex items-center justify-center py-1">
      <div className="flex flex-col items-center gap-0.5">
        <div className="w-0.5 h-3" style={{background:'var(--fal-border-medium)'}} />
        <ChevronRight className="w-3.5 h-3.5 rotate-90" style={{color:'var(--fal-border-medium)'}} />
        <div className="w-0.5 h-3" style={{background:'var(--fal-border-medium)'}} />
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.stepNumber
 * @param {any=} props.stepLabel
 * @param {any=} props.icon
 * @param {any=} props.colorStyle
 * @param {any=} props.children
 */
function StepBlock({ stepNumber, stepLabel, icon: StepIcon, colorStyle, children }) {
  return (
    <div className="relative">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold"
          style={colorStyle}>
          {stepNumber}
        </div>
        <div className="flex items-center gap-1.5">
          <StepIcon className="w-3.5 h-3.5" style={{color: colorStyle?.background}} />
          <span className="text-xs font-semibold uppercase tracking-wide fal-muted">{stepLabel}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.latestAssessment
 * @param {any=} props.falSnap
 * @param {any=} props.plan
 * @param {any=} props.tasks
 * @param {any=} props.reviews
 * @param {any=} props.reportVersions
 * @param {any=} props.onNewDiagnosis
 * @param {any=} props.tenantId
 */
export default function FalJourneyBlock({
  latestAssessment, falSnap, plan, tasks, reviews, reportVersions,
  onNewDiagnosis, tenantId
}) {
  const activeTasks = tasks.filter(t => t.status !== 'cancelled');
  const doneTasks = activeTasks.filter(t => ['done', 'completed'].includes(t.status));
  const criticalOpen = activeTasks.filter(t => t.priority === 'critical' && !['done', 'completed'].includes(t.status));
  const planProgress = activeTasks.length ? Math.round((doneTasks.length / activeTasks.length) * 100) : 0;
  const completedReviews = reviews.filter(r => r.status === 'completed').sort((a, b) => b.review_number - a.review_number);
  const lastReview = completedReviews[0] || null;
  const activeReports = (reportVersions || []).filter(r => r.status !== 'archived');
  const lastReport = activeReports[0] || null;

  // URL base do plano de ação (nova rota, sem tab legado)
  const planUrl = latestAssessment ? `/assessment/${latestAssessment.id}/action-plan` : null;

  const falStatusStyle =
    latestAssessment?.status === 'published' ? {background:'var(--fal-success-bg)', color:'var(--fal-success-text)'} :
    latestAssessment?.status === 'in_progress' ? {background:'var(--fal-current-bg)', color:'var(--fal-current-text)'} :
    {background:'var(--fal-neutral-bg)', color:'var(--fal-neutral-text)'};

  const falStatusLabel =
    latestAssessment?.status === 'published' ? 'Publicado' :
    latestAssessment?.status === 'in_progress' ? 'Em andamento' :
    latestAssessment?.status === 'draft' ? 'Rascunho' :
    latestAssessment?.status || '';

  const stepNavy  = {background:'var(--fal-navy-950)', color:'#fff'};
  const stepGreen = {background:'var(--fal-green-700)', color:'#fff'};
  const stepBlue  = {background:'#1e40af', color:'#fff'};

  // Dots de progresso do header (4 agora)
  const dot = (active) => (
    <div className="w-2 h-2 rounded-full" style={{background: active ? 'var(--fal-green-700)' : 'var(--fal-border-medium)'}} />
  );
  const line = () => <div className="w-6 h-0.5" style={{background:'var(--fal-border-medium)'}} />;

  return (
    <div className="fal-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between" style={{borderBottom:'1px solid var(--fal-border-subtle)'}}>
        <div>
          <p className="text-sm font-bold fal-title">Jornada FAL</p>
          <p className="text-xs fal-muted">Diagnóstico → Plano → Revisões → Relatório</p>
        </div>
        <div className="flex items-center gap-1">
          {dot(!!latestAssessment)}
          {line()}
          {dot(!!plan)}
          {line()}
          {dot(!!lastReview)}
          {line()}
          {dot(!!lastReport)}
        </div>
      </div>

      <div className="p-5 space-y-1">

        {/* ── ETAPA 1: Diagnóstico FAL ── */}
        <StepBlock stepNumber="1" stepLabel="Diagnóstico FAL" icon={BarChart3} colorStyle={stepNavy}>
          <div className="rounded-xl p-4 space-y-3" style={{border:'1px solid var(--fal-current-border)', background:'var(--fal-current-bg)'}}>
            {!latestAssessment ? (
              <div className="text-center py-3">
                <p className="text-xs fal-muted mb-3">Nenhum diagnóstico FAL iniciado.</p>
                <Button size="sm" className="text-white gap-1.5" style={{background:'var(--fal-green-700)'}} onClick={onNewDiagnosis}>
                  <Plus className="w-3.5 h-3.5" /> Iniciar diagnóstico
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold fal-title truncate">{latestAssessment.title}</p>
                    {latestAssessment.competence && (
                      <p className="text-xs fal-muted">Competência: {latestAssessment.competence}</p>
                    )}
                  </div>
                  <span className="fal-badge flex-shrink-0" style={falStatusStyle}>{falStatusLabel}</span>
                </div>
                {falSnap && (
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-xl font-black fal-title">{falSnap.overall_score?.toFixed(2)}</p>
                      <p className="text-xs fal-muted">IFME™</p>
                    </div>
                    {falSnap.overall_level && (
                      <span className="fal-badge" style={LEVEL_STYLE_INL[falSnap.overall_level] || {}}>
                        {falSnap.overall_level}
                      </span>
                    )}
                    {falSnap.critical_dimensions?.length > 0 && (
                      <span className="text-[10px] font-medium" style={{color:'var(--fal-danger-text)'}}>
                        {falSnap.critical_dimensions.length} dim. crítica(s)
                      </span>
                    )}
                  </div>
                )}
                {!falSnap && latestAssessment.status === 'in_progress' && (
                  <div className="flex items-center gap-1.5 text-xs" style={{color:'var(--fal-warning-text)'}}>
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    Diagnóstico em preenchimento — conclua para calcular scores.
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" className="text-white gap-1.5" style={{background:'var(--fal-navy-850)'}} asChild>
                    <Link to={createPageUrl(`AssessmentDetail?id=${latestAssessment.id}`)}>
                      <BarChart3 className="w-3 h-3" />
                      {latestAssessment.status === 'in_progress' ? 'Continuar diagnóstico' : 'Ver diagnóstico'}
                    </Link>
                  </Button>
                  <Button size="sm" variant="ghost" className="gap-1 fal-muted" onClick={onNewDiagnosis}>
                    <Plus className="w-3 h-3" /> Novo
                  </Button>
                </div>
              </>
            )}
          </div>
        </StepBlock>

        <StepConnector />

        {/* ── ETAPA 2: Plano de Ação vinculado ── */}
        <StepBlock stepNumber="2" stepLabel="Plano de Ação vinculado" icon={Zap} colorStyle={stepGreen}>
          <div className="rounded-xl p-4 space-y-3" style={{border:'1px solid var(--fal-success-border)', background:'var(--fal-success-bg)'}}>
            {!latestAssessment ? (
              <p className="text-xs fal-muted py-2">Inicie o diagnóstico FAL para habilitar o plano de ação.</p>
            ) : !plan ? (
              <div className="text-center py-3">
                <p className="text-xs fal-muted mb-1">Nenhum plano gerado ainda.</p>
                <p className="text-[11px] mb-3" style={{color:'var(--fal-text-light)'}}>Publique o diagnóstico para criar o plano vinculado.</p>
                {planUrl && (
                  <Button size="sm" className="text-white gap-1.5" style={{background:'var(--fal-green-700)'}} asChild>
                    <Link to={planUrl}>
                      <Zap className="w-3.5 h-3.5" /> Gerar plano de ação
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xl font-black fal-title">{doneTasks.length}/{activeTasks.length}</p>
                    <p className="text-xs fal-muted">Ações concluídas</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold" style={{color:'var(--fal-green-700)'}}>{planProgress}%</p>
                    <p className="text-xs fal-muted">Progresso</p>
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{background:'rgba(0,107,58,0.15)'}}>
                  <div className="h-full rounded-full transition-all" style={{width:`${planProgress}%`, background:'var(--fal-green-700)'}} />
                </div>
                {criticalOpen.length > 0 && (
                  <span className="flex items-center gap-1 text-xs" style={{color:'var(--fal-danger-text)'}}>
                    <AlertCircle className="w-3 h-3" /> {criticalOpen.length} crítica(s) em aberto
                  </span>
                )}
                <p className="text-[10px] italic" style={{color:'var(--fal-text-light)'}}>
                  Este plano está vinculado ao Diagnóstico FAL inicial e registra a evolução das ações ao longo das revisões.
                </p>
                {planUrl && (
                  <Button size="sm" className="text-white gap-1.5" style={{background:'var(--fal-green-700)'}} asChild>
                    <Link to={planUrl}>
                      <Zap className="w-3 h-3" /> Acompanhar plano
                    </Link>
                  </Button>
                )}
              </>
            )}
          </div>
        </StepBlock>

        <StepConnector />

        {/* ── ETAPA 3: Revisões ── */}
        <StepBlock stepNumber="3" stepLabel="Revisões" icon={GitBranch} colorStyle={stepGreen}>
          <div className="rounded-xl p-4 space-y-3" style={{border:'1px solid var(--fal-success-border)', background:'var(--fal-green-50)'}}>
            {!plan ? (
              <p className="text-xs fal-muted py-2">O plano de ação precisa ser gerado antes das revisões.</p>
            ) : completedReviews.length === 0 ? (
              <div className="text-center py-3">
                <p className="text-xs fal-muted mb-3">Nenhuma revisão registrada ainda.</p>
                {planUrl && (
                  <Button size="sm" className="text-white gap-1.5" style={{background:'var(--fal-green-700)'}} asChild>
                    <Link to={planUrl}>
                      <GitBranch className="w-3.5 h-3.5" /> Registrar primeira revisão
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xl font-black fal-title">{completedReviews.length}</p>
                    <p className="text-xs fal-muted">Revisões realizadas</p>
                  </div>
                  {lastReview && (
                    <div className="text-right">
                      <p className="text-xs font-semibold" style={{color:'var(--fal-text-primary)'}}>Última revisão</p>
                      <p className="text-xs fal-muted">
                        {lastReview.review_date ? format(new Date(lastReview.review_date + 'T12:00'), 'dd/MM/yyyy') : '—'}
                      </p>
                      {lastReview.overall_progress_before != null && lastReview.overall_progress_after != null && (
                        <p className="text-[10px] font-medium" style={{color:'var(--fal-success-text)'}}>
                          {lastReview.overall_progress_before}% → {lastReview.overall_progress_after}%
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {planUrl && (
                  <div className="flex gap-2">
                    <Button size="sm" className="text-white gap-1.5" style={{background:'var(--fal-green-700)'}} asChild>
                      <Link to={planUrl}>
                        <GitBranch className="w-3 h-3" /> Nova revisão
                      </Link>
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1 fal-muted" asChild>
                      <Link to={planUrl}>
                        Ver revisões <ArrowRight className="w-3 h-3" />
                      </Link>
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </StepBlock>

        <StepConnector />

        {/* ── ETAPA 4: Relatório Executivo ── */}
        <StepBlock stepNumber="4" stepLabel="Relatório Executivo" icon={FileText} colorStyle={stepBlue}>
          <div className="rounded-xl p-4 space-y-3" style={{border:'1px solid #bfdbfe', background:'#eff6ff'}}>
            {!latestAssessment ? (
              <p className="text-xs fal-muted py-2">Conclua as etapas anteriores para gerar relatórios.</p>
            ) : !lastReport ? (
              <div className="text-center py-3">
                <p className="text-xs fal-muted mb-3">Nenhum relatório emitido ainda.</p>
                <Button size="sm" className="gap-1.5 text-white" style={{background:'#1e40af'}} asChild>
                  <Link to={createPageUrl(`AssessmentDetail?id=${latestAssessment.id}`)}>
                    <FileText className="w-3.5 h-3.5" /> Gerar relatório executivo
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xl font-black fal-title">{activeReports.length}</p>
                    <p className="text-xs fal-muted">Relatório(s) emitido(s)</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold" style={{color:'var(--fal-text-primary)'}}>Último</p>
                    <p className="text-xs fal-muted">
                      {lastReport.generated_at ? format(new Date(lastReport.generated_at), 'dd/MM/yyyy') : '—'}
                    </p>
                  </div>
                </div>
                <Button size="sm" className="gap-1.5 text-white" style={{background:'#1e40af'}} asChild>
                  <Link to={createPageUrl(`AssessmentDetail?id=${latestAssessment.id}`)}>
                    <FileText className="w-3 h-3" /> Ver relatórios
                  </Link>
                </Button>
              </>
            )}
          </div>
        </StepBlock>

      </div>
    </div>
  );
}