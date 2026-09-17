/**
 * GroupTaxReformTab — Aba Reforma Tributária 8D do Grupo.
 * Espelha GroupDiagnostic8DTab.jsx, mas escopado ao MethodVersion da
 * Reforma Tributária 8D (não ao FAL 8D clássico) via useGroupAssessment
 * com methodVersionId — evita misturar os dois diagnósticos na mesma tela.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatIFME, useGroupAssessment } from '@/lib/hooks/useGroupAssessment';
import { useTaxReformMethodVersion } from '@/lib/hooks/useTaxReformMethodVersion';
import {
  Scale, PlayCircle, ArrowRight, Clock, CheckCircle2,
  AlertCircle, Loader2, ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';

const STATUS_CONFIG = {
  draft:       { label: 'Rascunho',              cls: 'fal-badge-neutral',  icon: Clock },
  in_progress: { label: 'Em andamento',          cls: 'fal-badge-current',  icon: Loader2 },
  scoring:     { label: 'Em apuração',           cls: 'fal-badge-current',  icon: Loader2 },
  review:      { label: 'Em revisão',            cls: 'fal-badge-warning',  icon: AlertCircle },
  published:   { label: 'Publicado',             cls: 'fal-badge-success',  icon: CheckCircle2 },
  archived:    { label: 'Arquivado',             cls: 'fal-badge-neutral',  icon: Clock },
};

/**
 * @param {Object} props
 * @param {any=} props.groupId
 * @param {any=} props.tenantId
 */
export default function GroupTaxReformTab({ groupId, tenantId }) {
  const navigate = useNavigate();
  const { methodVersion: taxReformMethodVersion, isLoading: loadingMethod } = useTaxReformMethodVersion();
  const { assessment, assessments, loading } = useGroupAssessment(
    groupId, tenantId, { methodVersionId: taxReformMethodVersion?.id ?? null }
  );

  const { data: snaps = [] } = useQuery({
    queryKey: ['tax-reform-snap', assessment?.id, tenantId],
    queryFn: () => base44.entities.FalDiagnosticSnapshot.filter(
      { assessment_id: assessment.id, tenant_id: tenantId }, '-computed_at', 1
    ),
    enabled: !!assessment?.id && !!tenantId,
  });
  const snap = snaps[0] || null;

  const { data: plans = [] } = useQuery({
    queryKey: ['tax-reform-plan', assessment?.id, tenantId],
    queryFn: () => base44.entities.ActionPlan.filter(
      { assessment_id: assessment.id, tenant_id: tenantId }, '-generated_at', 1
    ),
    enabled: !!assessment?.id && !!tenantId,
  });
  const hasPlan = plans.length > 0;

  if (loading || loadingMethod) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-orange-50">
          <Scale className="w-7 h-7 text-orange-600" />
        </div>
        <h2 className="text-base font-bold text-slate-900 mb-2">Nenhum Diagnóstico de Reforma Tributária iniciado para este Grupo</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
          Mede a prontidão do Grupo para a transição do IBS/CBS nas mesmas oito dimensões do Método FAL™, com plano de ação de migração organizacional próprio.
        </p>
        <Button
          onClick={() => navigate(createPageUrl(`FalAssessmentSetup?group_id=${groupId}&method=reforma_tributaria`))}
          className="text-white gap-2"
          style={{ background: '#ea580c' }}
          disabled={!taxReformMethodVersion}
        >
          <PlayCircle className="w-4 h-4" /> Iniciar Diagnóstico de Reforma Tributária
        </Button>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[assessment.status] || STATUS_CONFIG.draft;
  const StatusIcon = cfg.icon;
  const progress = assessment.progress_percentage != null ? Math.round(assessment.progress_percentage) : 0;
  const isActive = ['in_progress', 'scoring', 'review', 'draft'].includes(assessment.status);
  const isComplete = progress >= 100;
  const isPublished = assessment.status === 'published';

  const progressLabel =
    isPublished   ? 'Publicado' :
    isComplete    ? 'Pronto para publicação' :
    `Em andamento — ${progress}% preenchido`;

  const btnLabel = isPublished ? 'Abrir Diagnóstico' : isComplete ? 'Publicar Diagnóstico' : 'Continuar Diagnóstico';

  const others = assessments.filter(a => a.id !== assessment.id && a.status !== 'archived');

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 flex items-start gap-4 border-b border-slate-100">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(234,88,12,0.12)' }}>
            <Scale className="w-5 h-5" style={{ color: '#ea580c' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`fal-badge ${cfg.cls}`}>
                <StatusIcon className="w-3 h-3" /> {cfg.label}
              </span>
              {assessment.assessment_type && (
                <span className="text-[10px] px-2 py-0.5 rounded font-medium"
                  style={{ background: '#f1f5f9', color: '#475569' }}>
                  {assessment.assessment_type === 'diagnostico_inicial' ? 'Diagnóstico Inicial' : assessment.assessment_type}
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-slate-900 truncate">{assessment.title || assessment.display_name}</h2>
            <p className="text-xs mt-0.5 text-slate-500">
              {progressLabel}
              {assessment.started_at ? ` · Iniciado em ${format(new Date(assessment.started_at), 'dd/MM/yyyy')}` : ''}
            </p>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="rounded-xl p-3 text-center" style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
              <p className="text-xl font-black text-slate-900">{formatIFME(snap?.overall_score)}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Prontidão</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
              <p className="text-sm font-bold text-slate-900">{snap?.overall_level || '—'}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Maturidade</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
              <p className="text-xl font-black text-slate-900">{progress}%</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Progresso</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
              <p className="text-sm font-bold text-slate-900">
                {assessment.diagnostic_depth === 'deep' ? 'Profundo' : assessment.diagnostic_depth === 'standard' ? 'Padrão' : 'Rápido'}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Nível</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={() => navigate(createPageUrl(`AssessmentDetail?id=${assessment.id}`))}
              className="text-white gap-2"
              style={{ background: '#ea580c' }}
            >
              {isActive ? <PlayCircle className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              {btnLabel}
            </Button>
            {hasPlan && (
              <Button
                variant="outline" size="sm" className="gap-1.5"
                onClick={() => navigate(createPageUrl(`assessment/${assessment.id}/action-plan`))}
              >
                <ChevronRight className="w-3.5 h-3.5" /> Ir para Plano de Ação
              </Button>
            )}
          </div>
        </div>
      </div>

      {others.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2">Outros diagnósticos de Reforma Tributária ativos deste grupo</p>
          <div className="space-y-2">
            {others.map(a => {
              const c = STATUS_CONFIG[a.status] || STATUS_CONFIG.draft;
              return (
                <button
                  key={a.id}
                  onClick={() => navigate(createPageUrl(`AssessmentDetail?id=${a.id}`))}
                  className="w-full text-left bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3 transition-colors"
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <Scale className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{a.title || a.display_name}</p>
                    <p className="text-xs text-slate-500">{a.started_at ? format(new Date(a.started_at), 'dd/MM/yyyy') : '—'}</p>
                  </div>
                  <span className={`fal-badge ${c.cls} flex-shrink-0`}>{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
