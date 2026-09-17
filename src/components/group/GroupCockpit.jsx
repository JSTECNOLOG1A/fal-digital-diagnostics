/**
 * GroupCockpit — Cockpit executivo da Visão Geral do Grupo (Mesa FAL)
 * Busca robusta: target_type/target_id + group_id (deduplica).
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import {
  BarChart3, Zap, TrendingUp, FileText, GitBranch,
  AlertTriangle, ArrowRight, AlertCircle, RefreshCw,
  ChevronRight, Navigation } from
'lucide-react';
import { format } from 'date-fns';
import ReviewEvolutionChart from './ReviewEvolutionChart';
import { useGroupAssessment, formatIFME } from '@/lib/hooks/useGroupAssessment';
import { computeNextMovement, SEVERITY_COLOR } from '@/lib/group/nextMovementEngine';

const fmt = formatIFME;

const LEVEL_STYLE = {
  Crítico: { bg: 'var(--fal-danger-bg)', text: 'var(--fal-danger-text)', border: 'var(--fal-danger-border)' },
  Básico: { bg: 'var(--fal-warning-bg)', text: 'var(--fal-warning-text)', border: 'var(--fal-warning-border)' },
  Estruturado: { bg: 'var(--fal-current-bg)', text: 'var(--fal-current-text)', border: 'var(--fal-current-border)' },
  Avançado: { bg: 'var(--fal-success-bg)', text: 'var(--fal-success-text)', border: 'var(--fal-success-border)' }
};

// Rótulos amigáveis para status interno do assessment
const DIAG_STATUS_LABEL = {
  draft: 'Rascunho',
  in_progress: 'Em andamento',
  scoring: 'Em apuração',
  review: 'Em revisão',
  published: 'Publicado',
  archived: 'Arquivado'
};

const DIAG_STATUS_STYLE = {
  draft: { background: 'var(--fal-neutral-bg)', color: 'var(--fal-neutral-text)' },
  in_progress: { background: 'var(--fal-current-bg)', color: 'var(--fal-current-text)' },
  scoring: { background: 'var(--fal-warning-bg)', color: 'var(--fal-warning-text)' },
  review: { background: 'var(--fal-warning-bg)', color: 'var(--fal-warning-text)' },
  published: { background: 'var(--fal-success-bg)', color: 'var(--fal-success-text)' },
  archived: { background: 'var(--fal-neutral-bg)', color: 'var(--fal-neutral-text)' }
};

/**
 * @param {Object} props
 * @param {any=} props.active
 */
function StepDot({ active }) {
  return (
    <span className="inline-block w-2 h-2 rounded-full flex-shrink-0"
    style={{ background: active ? '#3b82f6' : 'var(--fal-border-medium)' }} />);

}

/**
 * @param {Object} props
 * @param {any=} props.icon
 * @param {any=} props.iconColor
 * @param {any=} props.label
 * @param {any=} props.sublabel
 * @param {any=} props.badge
 * @param {any=} props.badgeStyle
 * @param {any=} props.action
 * @param {any=} props.actionLabel
 * @param {any=} props.actionHref
 * @param {any=} props.actionOnClick
 * @param {any=} props.dimmed
 */
function ModuleCard({ icon, iconColor, label, sublabel, badge, badgeStyle, action, actionLabel, actionHref, actionOnClick, dimmed }) {
  const Icon = icon;
  return (
    <div className="rounded-xl p-4 flex flex-col gap-3"
    style={{
      background: dimmed ? 'var(--fal-bg-soft)' : 'var(--fal-bg-card)',
      border: '1px solid var(--fal-border-soft)',
      opacity: dimmed ? 0.7 : 1
    }}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: iconColor + '18' }}>
          <Icon className="w-4 h-4" style={{ color: iconColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold" style={{ color: 'var(--fal-text-strong)' }}>{label}</p>
          {sublabel && <p className="text-[11px] mt-0.5 leading-tight" style={{ color: 'var(--fal-text-muted)' }}>{sublabel}</p>}
        </div>
        {badge &&
        <span className="fal-badge flex-shrink-0" style={badgeStyle}>{badge}</span>
        }
      </div>
      {action && (
      actionHref ?
      <Link to={actionHref}>
            <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs h-7">
              {actionLabel} <ArrowRight className="w-3 h-3" />
            </Button>
          </Link> :

      <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs h-7" onClick={actionOnClick}>
            {actionLabel} <ArrowRight className="w-3 h-3" />
          </Button>)

      }
    </div>);

}

/**
 * @param {Object} props
 * @param {any=} props.icon
 * @param {any=} props.message
 * @param {any=} props.style
 */
function AlertCard({ icon, message, style }) {
  const Icon = icon;
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg"
    style={{ background: style.bg, border: `1px solid ${style.border}` }}>
      <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: style.text }} />
      <p className="text-xs leading-snug" style={{ color: style.text }}>{message}</p>
    </div>);

}

/**
 * @param {Object} props
 * @param {any=} props.groupId
 * @param {any=} props.tenantId
 * @param {any=} props.group
 * @param {any=} props.aggSnap
 * @param {any=} props.financialCount
 * @param {any=} props.onGoTo
 */
export default function GroupCockpit({ groupId, tenantId, group, aggSnap, financialCount, onGoTo }) {
  // ── Busca centralizada via hook ───────────────────────────────────────
  const { assessment } = useGroupAssessment(groupId, tenantId);

  const { data: snaps = [] } = useQuery({
    queryKey: ['cockpit-snap', assessment?.id, tenantId],
    queryFn: () => base44.entities.FalDiagnosticSnapshot.filter(
      { assessment_id: assessment.id, tenant_id: tenantId }, '-computed_at', 1
    ),
    enabled: !!assessment?.id && !!tenantId
  });
  const falSnap = snaps[0] || null;

  const { data: plans = [] } = useQuery({
    queryKey: ['cockpit-plan', assessment?.id, tenantId],
    queryFn: () => base44.entities.ActionPlan.filter(
      { assessment_id: assessment.id, tenant_id: tenantId }, '-generated_at', 1
    ),
    enabled: !!assessment?.id && !!tenantId
  });
  const plan = plans[0] || null;

  const { data: tasks = [] } = useQuery({
    queryKey: ['cockpit-tasks', plan?.id, tenantId],
    queryFn: () => base44.entities.ActionTask.filter(
      { plan_id: plan.id, tenant_id: tenantId }, '-priority_score', 100
    ),
    enabled: !!plan?.id && !!tenantId
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['cockpit-reviews', plan?.id, tenantId],
    queryFn: () => base44.entities.ActionPlanReview.filter(
      { action_plan_id: plan.id, tenant_id: tenantId }, '-review_date', 20
    ),
    enabled: !!plan?.id && !!tenantId
  });

  const { data: reportVersions = [] } = useQuery({
    queryKey: ['cockpit-reports', assessment?.id, tenantId],
    queryFn: () => base44.entities.AssessmentReportVersion.filter(
      { assessment_id: assessment.id, tenant_id: tenantId }, '-generated_at', 5
    ),
    enabled: !!assessment?.id && !!tenantId
  });

  // ── Derivações ────────────────────────────────────────────────────────
  const activeTasks = tasks.filter((t) => t.status !== 'cancelled');
  const doneTasks = activeTasks.filter((t) => ['done', 'completed'].includes(t.status));
  const openTasks = activeTasks.filter((t) => !['done', 'completed'].includes(t.status));
  const criticalOpen = openTasks.filter((t) => t.priority === 'critical');
  const planProgress = activeTasks.length ? Math.round(doneTasks.length / activeTasks.length * 100) : 0;
  const completedReviews = reviews.filter((r) => r.status === 'completed').sort((a, b) => b.review_number - a.review_number);
  const lastReview = completedReviews[0] || null;
  const lastReport = reportVersions.filter((r) => r.status !== 'archived')[0] || null;

  const hasDiag = !!assessment;
  const hasPlan = !!plan;
  const hasReviews = completedReviews.length > 0;
  const hasFinancial = financialCount > 0;
  const hasReport = !!lastReport;

  // IFME sempre da mesma fonte: falSnap > aggSnap
  const score = falSnap?.overall_score ?? aggSnap?.overall_score ?? null;
  const level = falSnap?.overall_level ?? aggSnap?.overall_level ?? null;
  const levelStyle = level ? LEVEL_STYLE[level] : null;

  const progress = assessment?.progress_percentage != null ? Math.round(assessment.progress_percentage) : 0;
  const isComplete = progress >= 100;
  const isPublished = assessment?.status === 'published';
  const isActive = assessment && ['in_progress', 'scoring', 'review', 'draft'].includes(assessment.status);

  // ── Status descritivo contextual ──────────────────────────────────────
  const diagSublabel = !hasDiag ? 'Não iniciado' :
  isPublished ? `Publicado${falSnap ? ` · IFME™ ${fmt(falSnap.overall_score)}` : ''}` :
  isComplete ? 'Pronto para publicação — 100% preenchido' :
  `Em andamento — ${progress}% preenchido`;

  const diagBadgeLabel = !hasDiag ? null : DIAG_STATUS_LABEL[assessment.status] ?? assessment.status;
  const diagBadgeStyle = !hasDiag ? {} : DIAG_STATUS_STYLE[assessment.status] ?? DIAG_STATUS_STYLE.draft;

  // ── Botão contextual do diagnóstico ──────────────────────────────────
  const diagActionLabel =
  !hasDiag ? null :
  isPublished ? 'Abrir diagnóstico' :
  isComplete ? 'Publicar diagnóstico' :
  'Continuar diagnóstico';

  // ── Plano: sublabel detalhado ─────────────────────────────────────────
  const planSublabel = !hasPlan ? 'Nenhum plano gerado' :
  criticalOpen.length > 0 ?
  `${openTasks.length} abertas · ${criticalOpen.length} críticas · ${doneTasks.length} concluídas` :
  `${doneTasks.length}/${activeTasks.length} ações · ${planProgress}% concluído`;

  // ── Resumo executivo narrativo ────────────────────────────────────────
  const execSummary = (() => {
    const parts = [];
    if (level) parts.push(`Maturidade ${level}`);
    if (isPublished && falSnap) parts.push(`IFME™ ${fmt(falSnap.overall_score)}`);else
    if (hasDiag && isActive) parts.push(isComplete ? 'Pronto para publicação' : `Diagnóstico ${progress}% preenchido`);else
    if (!hasDiag) parts.push('Sem diagnóstico iniciado');
    if (hasPlan && criticalOpen.length > 0) parts.push(`${criticalOpen.length} tarefa(s) crítica(s) em aberto`);else
    if (hasPlan) parts.push(`Plano ${planProgress}% concluído`);else
    if (hasDiag && isPublished) parts.push('Sem plano de ação gerado');
    if (!hasFinancial) parts.push('Sem análise financeira vinculada');
    return parts.join(' · ');
  })();

  // ── Alertas executivos ────────────────────────────────────────────────
  const alerts = [];
  if (!hasDiag) alerts.push({ icon: BarChart3, message: 'Nenhum Diagnóstico 8D iniciado para este grupo.', style: { bg: 'var(--fal-warning-bg)', text: 'var(--fal-warning-text)', border: 'var(--fal-warning-border)' } });
  if (hasDiag && isPublished && !hasPlan) alerts.push({ icon: Zap, message: 'Diagnóstico publicado sem Plano de Ação gerado.', style: { bg: 'var(--fal-warning-bg)', text: 'var(--fal-warning-text)', border: 'var(--fal-warning-border)' } });
  if (hasPlan && !hasReviews) alerts.push({ icon: GitBranch, message: 'Plano de Ação sem nenhuma revisão registrada.', style: { bg: 'var(--fal-current-bg)', text: 'var(--fal-current-text)', border: 'var(--fal-current-border)' } });
  if (!hasFinancial) alerts.push({ icon: TrendingUp, message: 'Nenhuma Análise Financeira vinculada ao grupo.', style: { bg: 'var(--fal-neutral-bg)', text: 'var(--fal-neutral-text)', border: 'var(--fal-neutral-border)' } });
  if (hasPlan && !hasReport) alerts.push({ icon: FileText, message: 'Nenhum relatório gerado ainda.', style: { bg: 'var(--fal-neutral-bg)', text: 'var(--fal-neutral-text)', border: 'var(--fal-neutral-border)' } });
  if (criticalOpen.length > 0) alerts.push({ icon: AlertCircle, message: `${criticalOpen.length} tarefa(s) crítica(s) em aberto no plano de ação.`, style: { bg: 'var(--fal-danger-bg)', text: 'var(--fal-danger-text)', border: 'var(--fal-danger-border)' } });

  // ── Próximo movimento — via NextMovementEngine ────────────────────────
  const nextMove = computeNextMovement({
    assessment, falSnap, hasFinancial, plan,
    criticalOpen: criticalOpen.length,
    openTasks: openTasks.length,
    hasReviews, hasReport,
    onGoTo, createPageUrl
  });

  const TRAIL = [
  { label: 'Diagnóstico 8D', active: hasDiag },
  { label: 'Análise Financeira', active: hasFinancial },
  { label: 'Plano de Ação', active: hasPlan },
  { label: 'Revisões', active: hasReviews },
  { label: 'Relatório', active: hasReport }];


  return (
    <div className="space-y-5">

      {/* ── Bloco 1: Resumo executivo ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">

        {/* IFME + dimensões críticas */}
        <div className="px-5 py-4 flex flex-wrap gap-5 items-center"
        style={{ borderBottom: '1px solid var(--fal-border-subtle)' }}>
          <div>
            <p className="text-3xl font-black fal-title">{fmt(score)}</p>
            <p className="text-[10px] uppercase tracking-wider fal-muted">IFME™ Consolidado</p>
          </div>
          {falSnap?.critical_dimensions?.length > 0 &&
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--fal-danger-text)' }}>
              <AlertTriangle className="w-3.5 h-3.5" />
              {falSnap.critical_dimensions.length} dimensão(ões) crítica(s)
            </div>
          }
        </div>

        {/* Trilha de status — barra de progresso da jornada */}
        <div className="px-5 py-3 flex items-center gap-2 flex-wrap"
        style={{ background: 'var(--fal-bg-soft)' }}>
          {TRAIL.map((item, i) =>
          <React.Fragment key={item.label}>
              <div className="flex items-center gap-1.5">
                <StepDot active={item.active} />
                <span className="text-[11px] font-medium"
              style={{ color: item.active ? 'var(--fal-text-primary)' : 'var(--fal-text-light)' }}>
                  {item.label}
                </span>
              </div>
              {i < TRAIL.length - 1 &&
            <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--fal-border-medium)' }} />
            }
            </React.Fragment>
          )}
        </div>
      </div>

      {/* ── Bloco 2: Trilha FAL — 5 módulos (grid 2+2+1) ── */}
      <div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          {/* Diagnóstico 8D */}
          <ModuleCard
            icon={BarChart3}
            iconColor="var(--fal-navy-800)"
            label="Diagnóstico 8D"
            sublabel={diagSublabel}
            badge={diagBadgeLabel}
            badgeStyle={diagBadgeStyle}
            action={hasDiag}
            actionLabel={diagActionLabel}
            actionHref={hasDiag ? createPageUrl(`AssessmentDetail?id=${assessment.id}`) : null}
            dimmed={!hasDiag} />
          

          {/* Análise Financeira */}
          <ModuleCard
            icon={TrendingUp}
            iconColor="#3b82f6"
            label="Análise Financeira"
            sublabel={!hasFinancial ? 'Nenhuma análise financeira vinculada' : `${financialCount} análise(s) registrada(s)`}
            badge={hasFinancial ? `${financialCount}` : null}
            badgeStyle={{ background: 'var(--fal-success-bg)', color: 'var(--fal-success-text)' }}
            action
            actionLabel={hasFinancial ? 'Ver análises' : 'Adicionar análise'}
            actionOnClick={() => onGoTo('analise-financeira')}
            dimmed={!hasFinancial} />
          

          {/* Plano de Ação */}
          <ModuleCard
            icon={Zap}
            iconColor="#2563eb"
            label="Plano de Ação"
            sublabel={planSublabel}
            badge={!hasPlan ? null : plan.status === 'active' ? 'Ativo' : plan.status}
            badgeStyle={{ background: 'var(--fal-success-bg)', color: 'var(--fal-success-text)' }}
            action={hasPlan}
            actionLabel="Acompanhar plano"
            actionOnClick={() => onGoTo('plano-acao')}
            dimmed={!hasPlan} />
          

          {/* Revisões */}
          <ModuleCard
            icon={RefreshCw}
            iconColor="var(--fal-navy-700)"
            label="Revisões"
            sublabel={
            !hasReviews ? 'Nenhuma revisão registrada' :
            `${completedReviews.length} revisão(ões) · Última: ${lastReview?.review_date ? format(new Date(String(lastReview.review_date).slice(0, 10) + 'T12:00'), 'dd/MM/yyyy') : '—'}`
            }
            badge={hasReviews ? `${completedReviews.length}` : null}
            badgeStyle={{ background: 'var(--fal-current-bg)', color: 'var(--fal-current-text)' }}
            action={hasPlan}
            actionLabel={hasReviews ? 'Ver revisões' : 'Registrar revisão'}
            actionHref={hasPlan ? `/assessment/${assessment.id}/action-plan` : null}
            dimmed={!hasPlan} />
          

          {/* Relatório — span completo na linha final */}
          <div className="sm:col-span-2">
            <ModuleCard
              icon={FileText}
              iconColor="var(--fal-navy-900)"
              label="Relatório Executivo"
              sublabel={
              !hasReport ? 'Nenhum relatório emitido' :
              `Última emissão: ${format(new Date(lastReport.generated_at), 'dd/MM/yyyy')} · ${lastReport.report_title || 'Relatório'}`
              }
              badge={hasReport ? 'Gerado' : null}
              badgeStyle={{ background: 'var(--fal-success-bg)', color: 'var(--fal-success-text)' }}
              action
              actionLabel={hasReport ? 'Ver relatórios' : 'Gerar relatório'}
              actionOnClick={() => onGoTo('relatorios')}
              dimmed={!hasReport} />
            
          </div>
        </div>
      </div>

      {/* ── Bloco 3: Síntese Integrada FAL + Financeiro ── */}
      {(hasDiag || hasFinancial) &&
      <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide fal-muted mb-3">Síntese Integrada · FAL + Financeiro</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg p-3 text-center"
          style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
              <p className="text-lg font-black fal-title">{fmt(score)}</p>
              <p className="text-[10px] fal-muted mt-0.5">IFME™</p>
              {level && <p className="text-[10px] font-semibold mt-1" style={{ color: levelStyle?.text }}>{level}</p>}
            </div>
            <div className="rounded-lg p-3 text-center"
          style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
              <p className="text-lg font-black fal-title">{hasFinancial ? financialCount : '—'}</p>
              <p className="text-[10px] fal-muted mt-0.5">Análise(s) Fin.</p>
            </div>
            <div className="rounded-lg p-3 text-center"
          style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
              <p className="text-lg font-black fal-title">{hasPlan ? openTasks.length : '—'}</p>
              <p className="text-[10px] fal-muted mt-0.5">Ações abertas</p>
              {criticalOpen.length > 0 &&
            <p className="text-[10px] font-semibold mt-0.5" style={{ color: 'var(--fal-danger-text)' }}>
                  {criticalOpen.length} crítica(s)
                </p>
            }
            </div>
            <div className="rounded-lg p-3 text-center"
          style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
              <p className="text-lg font-black fal-title">{hasReviews ? completedReviews.length : '—'}</p>
              <p className="text-[10px] fal-muted mt-0.5">Revisões</p>
            </div>
          </div>
        </div>
      }

      {/* ── Bloco 4: Alertas executivos ── */}
      {alerts.length > 0 &&
      <div>
          <p className="text-xs font-semibold uppercase tracking-wide fal-muted mb-2">Alertas</p>
          <div className="space-y-2">
            {alerts.map((a, i) =>
          <AlertCard key={i} icon={a.icon} message={a.message} style={a.style} />
          )}
          </div>
        </div>
      }

      {/* ── Bloco 5: Próximo movimento recomendado ── */}
      {nextMove &&
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-4"
      style={{ borderLeft: `3px solid ${SEVERITY_COLOR[nextMove.severity] || '#2563eb'}` }}>
          <div className="flex items-center gap-2.5">
            <Navigation className="w-4 h-4 flex-shrink-0" style={{ color: SEVERITY_COLOR[nextMove.severity] || '#2563eb' }} />
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--fal-text-strong)' }}>Próximo movimento recomendado</p>
              <p className="text-sm font-bold" style={{ color: SEVERITY_COLOR[nextMove.severity] || '#2563eb' }}>{nextMove.label}</p>
              {nextMove.description &&
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--fal-text-muted)' }}>{nextMove.description}</p>
            }
            </div>
          </div>
          {nextMove.href ?
        <Link to={nextMove.href}>
              <Button size="sm" className="text-white gap-1.5 flex-shrink-0" style={{ background: '#2563eb' }}>
                {nextMove.actionLabel || 'Ir'} <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link> :

        <Button size="sm" className="text-white gap-1.5 flex-shrink-0" style={{ background: '#2563eb' }} onClick={nextMove.onClick}>
              {nextMove.actionLabel || 'Ir'} <ArrowRight className="w-3.5 h-3.5" />
            </Button>
        }
        </div>
      }

      {/* ── Bloco 6: Gráfico de evolução IFME™ ── */}
      {(falSnap || completedReviews.length > 0) &&
      <ReviewEvolutionChart baselineSnapshot={falSnap} reviews={reviews} />
      }

    </div>);

}