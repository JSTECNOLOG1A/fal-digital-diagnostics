/**
 * ActionPlanWorkflow — Fluxo completo de priorização antes de gerar o plano de ação.
 * 
 * Etapas:
 *  1. Gerar recomendações do diagnóstico (generateActionRecommendations)
 *  2. Revisar e priorizar com a ADM (aprovar / rejeitar recomendações)
 *  3. Gerar plano de ação (generateActionPlan) a partir das aprovadas
 *  4. Ver plano gerado (ActionPlanEmbed)
 */
import React, { useState } from 'react';
import { tenantKey, assessmentKey } from '@/lib/query-client';
import { useTenant } from '@/components/shared/TenantContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  Zap, CheckCircle2, X, ArrowRight, Loader2, Lightbulb,
  BookOpen, TrendingUp, BarChart3, User, Info, Sparkles
} from 'lucide-react';
import ActionPlanEmbed from './ActionPlanEmbed';

const SOURCE_CFG = {
  financial_diagnostic: { label: 'Financeiro',    icon: TrendingUp, cls: 'bg-emerald-100 text-emerald-700' },
  fal_diagnostic:       { label: 'FAL',           icon: BarChart3,  cls: 'bg-blue-100 text-blue-700' },
  library:              { label: 'Biblioteca',     icon: BookOpen,   cls: 'bg-violet-100 text-violet-700' },
  ai:                   { label: 'IA',             icon: Lightbulb,  cls: 'bg-amber-100 text-amber-700' },
  manual:               { label: 'Consultor',      icon: User,       cls: 'bg-slate-100 text-slate-600' },
};

const PRIORITY_CFG = {
  critical: { label: 'Crítica', cls: 'bg-red-100 text-red-700' },
  high:     { label: 'Alta',    cls: 'bg-amber-100 text-amber-700' },
  medium:   { label: 'Média',   cls: 'bg-blue-100 text-blue-700' },
  low:      { label: 'Baixa',   cls: 'bg-slate-100 text-slate-500' },
};

const DIM_LABELS = {
  governanca: 'Governança', juridico: 'Jurídico', controles_internos: 'Controles Internos',
  financeiro: 'Financeiro', contabil: 'Contábil', tributario: 'Fiscal',
  operacional: 'Operacional', sistemas: 'Tecnologia',
};

// ─── Cartão de recomendação na etapa de priorização ──────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.rec
 * @param {any=} props.onApprove
 * @param {any=} props.onReject
 * @param {any=} props.saving
 */
function RecCard({ rec, onApprove, onReject, saving }) {
  const src = SOURCE_CFG[rec.source_type] || SOURCE_CFG.manual;
  const pri = PRIORITY_CFG[rec.priority] || PRIORITY_CFG.medium;
  const isApproved = rec.status === 'approved';
  const isRejected = rec.status === 'rejected';

  return (
    <div className={`bg-white border rounded-xl p-4 transition-all ${
      isApproved ? 'border-emerald-300 bg-emerald-50/30' :
      isRejected ? 'border-slate-200 opacity-50' :
      'border-slate-200 hover:border-slate-300'
    }`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold ${src.cls}`}>
              {React.createElement(src.icon, { className: 'w-3 h-3' })} {src.label}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${pri.cls}`}>
              {pri.label}
            </span>
            {rec.dimension_key && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                {DIM_LABELS[rec.dimension_key] || rec.dimension_key}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-slate-800">{rec.title}</p>
          {rec.recommendation_text && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{rec.recommendation_text}</p>
          )}
          {rec.rationale && (
            <p className="text-xs text-slate-400 mt-0.5 italic line-clamp-1">{rec.rationale}</p>
          )}
        </div>

        {/* Ações */}
        {!isRejected && (
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            {isApproved ? (
              <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4" /> Aprovada
              </div>
            ) : (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 h-7 px-2.5 text-xs"
                onClick={() => onApprove(rec)}
                disabled={saving}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-slate-400 hover:text-red-500 h-7 px-2 text-xs gap-1"
              onClick={() => onReject(rec)}
              disabled={saving}
            >
              <X className="w-3 h-3" /> {isApproved ? 'Desfazer' : 'Rejeitar'}
            </Button>
          </div>
        )}
        {isRejected && (
          <Button
            size="sm"
            variant="ghost"
            className="text-slate-400 hover:text-slate-600 h-7 px-2 text-xs flex-shrink-0"
            onClick={() => onApprove(rec)}
          >
            Restaurar
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Principal ────────────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.assessmentId
 * @param {any=} props.snapshotDone
 */
export default function ActionPlanWorkflow({ assessmentId, snapshotDone }) {
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [generatingRecs, setGeneratingRecs] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [savingRec, setSavingRec] = useState(null); // id do rec sendo salvo
  const [filterStatus, setFilterStatus] = useState('pending');
  const [recsMode, setRecsMode] = useState('library_only'); // library_only | library_plus_ai

  // Buscar plano existente
  const { data: plans = [] } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId, 'action-plan'),
    queryFn: () => base44.entities.ActionPlan.filter({ assessment_id: assessmentId }, '-created_date', 1),
    enabled: !!assessmentId,
  });
  const plan = plans[0] || null;

  // Buscar assessment para ter tenant_id
  const { data: assessment } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId),
    queryFn: () => base44.entities.Assessment.get(assessmentId),
    enabled: !!assessmentId,
  });

  // Buscar recomendações
  const { data: recommendations = [], isLoading: loadingRecs } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId, 'action-recommendations'),
    queryFn: async () => {
      const recs = await base44.entities.ActionRecommendation.filter(
        { assessment_id: assessmentId }, '-created_date', 200
      );
      return recs;
    },
    enabled: !!assessmentId,
  });

  const pendingRecs  = recommendations.filter(r => ['needs_classification', 'suggested'].includes(r.status));
  const approvedRecs = recommendations.filter(r => r.status === 'approved');
  const rejectedRecs = recommendations.filter(r => r.status === 'rejected');

  const visibleRecs = filterStatus === 'pending'  ? pendingRecs
                    : filterStatus === 'approved' ? approvedRecs
                    : filterStatus === 'rejected' ? rejectedRecs
                    : recommendations;

  // ─── Gerar recomendações (etapa 1) ────────────────────────────────────────
  const handleGenerateRecs = async () => {
    if (!plan) {
      // Precisamos criar o plano primeiro para ter um action_plan_id
      setGeneratingRecs(true);
      try {
        // Gerar plano vazio via generateActionPlan para obter o ID
        const planRes = await base44.functions.invoke('generateActionPlan', { assessmentId, cycleId: null });
        await qc.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId, 'action-plan') });
        const newPlan = planRes?.data?.plan;
        if (!newPlan?.id) throw new Error('Falha ao criar plano base');

        await base44.functions.invoke('generateActionRecommendations', {
          assessment_id: assessmentId,
          action_plan_id: newPlan.id,
          mode: recsMode,
        });
        await qc.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId, 'action-recommendations') });
      } catch (e) {
        console.error(e);
      } finally {
        setGeneratingRecs(false);
      }
    } else {
      setGeneratingRecs(true);
      try {
        await base44.functions.invoke('generateActionRecommendations', {
          assessment_id: assessmentId,
          action_plan_id: plan.id,
          mode: recsMode,
        });
        await qc.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId, 'action-recommendations') });
      } catch (e) {
        console.error(e);
      } finally {
        setGeneratingRecs(false);
      }
    }
  };

  // ─── Aprovar recomendação ─────────────────────────────────────────────────
  const handleApprove = async (rec) => {
    setSavingRec(rec.id);
    const newStatus = rec.status === 'approved' ? 'suggested' : 'approved';
    await base44.functions.invoke('manageActionRecommendation', {
      action: 'approve',
      recommendation_id: rec.id,
    });
    if (newStatus !== 'approved') {
      // Desfazer aprovação — volta para suggested
      await base44.functions.invoke('manageActionRecommendation', {
        action: 'edit',
        recommendation_id: rec.id,
        updates: { status: 'suggested' },
      });
    }
    await qc.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId, 'action-recommendations') });
    setSavingRec(null);
  };

  // ─── Rejeitar recomendação ────────────────────────────────────────────────
  const handleReject = async (rec) => {
    setSavingRec(rec.id);
    await base44.functions.invoke('manageActionRecommendation', {
      action: 'reject',
      recommendation_id: rec.id,
    });
    await qc.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId, 'action-recommendations') });
    setSavingRec(null);
  };

  // ─── Gerar plano final com aprovadas ─────────────────────────────────────
  const handleGeneratePlan = async () => {
    setGeneratingPlan(true);
    await base44.functions.invoke('generateActionPlan', { assessmentId, cycleId: null });
    await qc.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId, 'action-plan') });
    await qc.invalidateQueries({ queryKey: tenantKey(tenantId, 'action-tasks') });
    setGeneratingPlan(false);
  };

  // ─── Se já tem plano com tarefas, mostrar diretamente o embed ─────────────
  const { data: tasks = [] } = useQuery({
    queryKey: tenantKey(tenantId, 'action-tasks', plan?.id),
    queryFn: () => base44.entities.ActionTask.filter({ plan_id: plan.id }, '-priority_score', 5),
    enabled: !!plan?.id,
    staleTime: 30_000,
  });
  const hasTasks = tasks.length > 0;

  if (plan && hasTasks) {
    return (
      <div className="space-y-4">
        <ActionPlanEmbed assessmentId={assessmentId} />
      </div>
    );
  }

  // ─── Fluxo de priorização ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Diagnóstico não concluído */}
      {!snapshotDone && (
        <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-400" />
          <span>Execute o diagnóstico completo primeiro para gerar as recomendações.</span>
        </div>
      )}

      {/* Step 1 — Gerar recomendações */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-blue-700">1</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Gerar recomendações do diagnóstico</p>
              <p className="text-xs text-slate-400 mt-0.5">
                O sistema analisa os gaps do FAL e sugere ações para cada área crítica.
              </p>
              {recommendations.length > 0 && (
                <p className="text-xs text-emerald-600 font-medium mt-1">
                  ✓ {recommendations.length} recomendações geradas
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Modo IA */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setRecsMode('library_only')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${recsMode === 'library_only' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
              >
                Biblioteca
              </button>
              <button
                onClick={() => setRecsMode('library_plus_ai')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${recsMode === 'library_plus_ai' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
              >
                <Sparkles className="w-3 h-3 text-amber-500" /> +IA
              </button>
            </div>
            <Button
              size="sm"
              onClick={handleGenerateRecs}
              disabled={generatingRecs || !snapshotDone}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              {generatingRecs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              {recommendations.length > 0 ? 'Regerar' : 'Gerar recomendações'}
            </Button>
          </div>
        </div>
      </div>

      {/* Step 2 — Priorização */}
      {recommendations.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-indigo-700">2</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">Revisar e priorizar com a ADM</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Aprove as recomendações que entrarão no plano de ação. Rejeite o que não se aplica.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs flex-shrink-0">
              <span className="text-emerald-600 font-semibold">{approvedRecs.length} aprovadas</span>
              <span className="text-slate-400">·</span>
              <span className="text-amber-600 font-semibold">{pendingRecs.length} pendentes</span>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
            {[
              { key: 'pending',  label: `Pendentes${pendingRecs.length > 0 ? ` (${pendingRecs.length})` : ''}` },
              { key: 'approved', label: `Aprovadas${approvedRecs.length > 0 ? ` (${approvedRecs.length})` : ''}` },
              { key: 'rejected', label: 'Rejeitadas' },
              { key: 'all',      label: 'Todas' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilterStatus(f.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filterStatus === f.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Lista */}
          {loadingRecs ? (
            <div className="text-center py-8 text-slate-400 text-sm">Carregando...</div>
          ) : visibleRecs.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              Nenhuma recomendação nesta categoria.
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {visibleRecs.map(rec => (
                <RecCard
                  key={rec.id}
                  rec={rec}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  saving={savingRec === rec.id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Gerar plano */}
      {recommendations.length > 0 && (
        <div className={`border rounded-xl p-5 transition-all ${approvedRecs.length > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${approvedRecs.length > 0 ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                <span className={`text-xs font-bold ${approvedRecs.length > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>3</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Gerar plano de ação</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {approvedRecs.length > 0
                    ? `${approvedRecs.length} recomendação(ões) aprovada(s) serão convertidas em tarefas priorizadas.`
                    : 'Aprove pelo menos uma recomendação para gerar o plano.'
                  }
                </p>
              </div>
            </div>
            <Button
              onClick={handleGeneratePlan}
              disabled={generatingPlan || approvedRecs.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {generatingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {generatingPlan ? 'Gerando plano...' : 'Gerar plano de ação'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}