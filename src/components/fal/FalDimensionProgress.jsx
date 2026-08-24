import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ChevronRight, CheckCircle2, MinusCircle, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { invalidateAssessmentQueries } from '@/lib/query-client';

import { FAL_DIMENSIONS } from '@/components/fal/falOfficialMatrix';
import DimensionInfoTooltip from '@/components/fal/DimensionInfoTooltip';

const ALL_DIMENSIONS = FAL_DIMENSIONS.map(d => ({ key: d.key, label: d.label }));

/**
 * @param {Object} props
 * @param {any=} props.assessmentId
 * @param {any=} props.questionSet
 * @param {any=} props.activeDimensions
 * @param {any=} props.scopeLocked
 * @param {any=} props.onOrphanDetected
 * @param {any=} props.buildQuestionnaireUrl
 * @param {any=} props.filterEntityId
 */
export default function FalDimensionProgress({
  assessmentId,
  questionSet = [],
  activeDimensions,
  scopeLocked,
  onOrphanDetected,
  // Optional: when provided, overrides the default questionnaire URL builder
  buildQuestionnaireUrl,
  // Optional: when provided, filters progress display to responses for a specific entity_id
  filterEntityId = null,
}) {
  const queryClient = useQueryClient();

  const { data: allQuestions = [], isLoading: loadingQuestions } = useQuery({
    queryKey: ['fal-questions', questionSet.slice().sort().join(',')],
    queryFn: () => base44.entities.FalQuestion.list('sequence_order', 2000),
    enabled: questionSet.length > 0,
  });

  const { data: responses = [] } = useQuery({
    queryKey: ['fal-responses', assessmentId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getFalResponses', { assessment_id: assessmentId });
      return res.data?.responses || [];
    },
    enabled: !!assessmentId,
  });

  // Active dimensions set (default: all 8)
  const activeDimSet = new Set(
    activeDimensions?.length ? activeDimensions : ALL_DIMENSIONS.map(d => d.key)
  );

  // Build question map and group by dimension
  const questionMap = {};
  for (const q of allQuestions) questionMap[q.id] = q;

  const byDim = {};
  for (const id of questionSet) {
    const q = questionMap[id];
    if (!q) continue;
    const dimKey = q.dimension_key;
    if (!dimKey) continue;
    if (!byDim[dimKey]) byDim[dimKey] = [];
    byDim[dimKey].push(q);
  }

  // When a filterEntityId is active, only count responses for that entity.
  // Falls back gracefully to all responses when no filter is set.
  const filteredResponses = filterEntityId
    ? responses.filter(r => r.evaluated_entity_id === filterEntityId)
    : responses;

  const answeredIds = new Set(filteredResponses.map(r => r.fal_question_id));
  const totalAnswered = filteredResponses.length;

  // Detecção de IDs órfãos: IDs no question_set que não encontram FalQuestion real.
  const knownIds = new Set(allQuestions.map(q => q.id));
  const orphanIds = !loadingQuestions && knownIds.size > 0
    ? questionSet.filter(id => typeof id === 'string' && id.trim() && !knownIds.has(id))
    : [];
  const hasOrphans = orphanIds.length > 0;

  // Notifica o pai sobre IDs órfãos (uma vez, quando detectados)
  useEffect(() => {
    if (hasOrphans && onOrphanDetected) {
      onOrphanDetected(orphanIds);
    }
     
  }, [hasOrphans]);

  // questionSet vazio é tratado pelo pai — filho não renderiza nada.
  if (questionSet.length === 0) return null;

  // Enquanto carrega as perguntas, mostra placeholder leve
  if (loadingQuestions) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  const handleActivateDim = async (dimKey) => {
    const newActive = [...activeDimSet, dimKey];
    await base44.entities.Assessment.update(assessmentId, { active_dimensions: newActive });
    await base44.functions.invoke('buildFalQuestionSet', { assessment_id: assessmentId });
    invalidateAssessmentQueries(queryClient, assessmentId);
  };

  // Resolve the URL for a dimension's questionnaire
  const getDimUrl = (dimKey) => {
    if (buildQuestionnaireUrl) return buildQuestionnaireUrl(dimKey);
    return createPageUrl(`DimensionQuestionnaire?assessment_id=${assessmentId}&dimension_key=${dimKey}`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-slate-700">IFME™ — Diagnóstico por Dimensão</h3>
        <span className="text-xs text-slate-400">
          {totalAnswered}/{questionSet.length} respondidas
          {filterEntityId && <span className="ml-1 text-blue-500">(filtrado)</span>}
        </span>
      </div>

      {/* Banner de IDs órfãos — question_set inconsistente */}
      {hasOrphans && (
        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-2 text-xs text-orange-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-orange-500" />
          <span>
            <strong>{orphanIds.length} pergunta(s) no questionário não foram encontradas no banco FAL</strong> — o questionário está inconsistente.
            Use "Regerar questionário" para corrigir.
          </span>
        </div>
      )}

      {ALL_DIMENSIONS.map(dim => {
        const isActive = activeDimSet.has(dim.key);
        const dimQs = byDim[dim.key] || [];
        const answered = dimQs.filter(q => answeredIds.has(q.id)).length;
        const pct = dimQs.length > 0 ? Math.round((answered / dimQs.length) * 100) : 0;
        const complete = dimQs.length > 0 && answered >= dimQs.length;

        if (!isActive) {
          return (
            <Card key={dim.key} className="border-0 shadow-sm opacity-60">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-400 line-through">{dim.label}</p>
                    <div className="flex items-center gap-2">
                      <MinusCircle className="w-4 h-4 text-slate-300" />
                      <span className="text-xs text-slate-300">Fora do escopo</span>
                      <button
                        onClick={() => handleActivateDim(dim.key)}
                        className="text-xs text-blue-500 hover:underline ml-2"
                      >
                        Ativar
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        }

        // Dimensão ativa mas sem perguntas no question_set
        if (dimQs.length === 0) {
          return (
            <Card key={dim.key} className="border border-amber-200 bg-amber-50/40 shadow-none">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <p className="text-sm text-amber-800 font-medium">{dim.label}</p>
                  </div>
                  <span className="text-[10px] text-amber-600 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                    Sem perguntas elegíveis
                  </span>
                </div>
                <p className="text-xs text-amber-600 mt-1.5 pl-6">
                  Esta dimensão está no escopo, mas não possui perguntas elegíveis para o perfil deste alvo.
                </p>
              </CardContent>
            </Card>
          );
        }

        const statusLabel = complete
          ? 'Concluída'
          : answered > 0
            ? 'Em andamento'
            : 'Não iniciada';

        return (
          <Link key={dim.key} to={getDimUrl(dim.key)}>
            <Card className={`border-0 shadow-sm fal-card-hover cursor-pointer ${complete ? 'ring-1 ring-emerald-200' : ''}`}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-slate-900">{dim.label}</p>
                      <DimensionInfoTooltip dimKey={dim.key} />
                    </div>
                    <div className="flex items-center gap-2">
                      {complete
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        : <span className="text-xs text-slate-400">{answered}/{dimQs.length}</span>
                      }
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        complete ? 'bg-emerald-50 text-emerald-600' :
                        answered > 0 ? 'bg-blue-50 text-blue-600' :
                        'bg-slate-100 text-slate-400'
                      }`}>{statusLabel}</span>
                    </div>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-slate-400">{dimQs.length} perguntas</span>
                    {pct > 0 && !complete && (
                      <span className="text-[10px] text-blue-500">{pct}% completo</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}