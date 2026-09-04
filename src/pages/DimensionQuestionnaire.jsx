/**
 * DimensionQuestionnaire — FAL Questionnaire Cockpit
 * Layout em duas colunas: card de pergunta (3/4) + lateral de monitoramento (1/4)
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { assessmentKey } from '@/lib/query-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import QuestionCard from '@/components/fal/questionnaire/QuestionCard';
import SwapQuestionModal from '@/components/fal/SwapQuestionModal';
import { getSubdimensionsForDimension, normalizeSubdimKey, getClustersForSubdimension, normalizeClusterKey, FAL_SUBDIMENSIONS } from '@/components/fal/falOfficialMatrix';
import QuestionnaireHeader from '@/components/shared/questionnaire/QuestionnaireHeader';
import QuestionnaireProgressBar from '@/components/shared/questionnaire/QuestionnaireProgressBar';
import CockpitSidebar from '@/components/fal/questionnaire/CockpitSidebar';

export default function DimensionQuestionnaire() {
  const params = new URLSearchParams(window.location.search);
  const assessmentId = params.get('assessment_id');
  const rawDimensionKey = params.get('dimension_key');
  const entityId     = params.get('entity_id');
  const entityType   = params.get('entity_type');

  const { user, tenantId } = useTenant();
  const queryClient = useQueryClient();
  const navigate    = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data: assessment } = useQuery({
    queryKey: assessmentKey(tenantId, assessmentId),
    queryFn:  () => base44.entities.Assessment.get(assessmentId),
    enabled:  !!assessmentId,
  });

  // Redireciona de forma inteligente se dimension_key estiver ausente
  useEffect(() => {
    if (assessment && !rawDimensionKey) {
      const firstActiveDim = assessment.active_dimensions?.[0] || 'governanca';
      let url = `DimensionQuestionnaire?assessment_id=${assessmentId}&dimension_key=${firstActiveDim}`;
      if (entityId && entityType) {
        url += `&entity_id=${entityId}&entity_type=${entityType}`;
      }
      navigate(createPageUrl(url), { replace: true });
    }
  }, [assessment, rawDimensionKey, assessmentId, entityId, entityType, navigate]);

  const dimensionKey = rawDimensionKey || (assessment?.active_dimensions?.[0] || 'governanca');

  const { data: falQuestions = [], isLoading: loadingQ } = useQuery({
    queryKey: ['fal-questions-dim', assessmentId, dimensionKey, entityType],
    queryFn: async () => {
      if (!assessment?.question_set?.length) return [];
      const dimQs  = await base44.entities.FalQuestion.filter({ dimension_key: dimensionKey });
      const qSetIds = new Set(assessment.question_set);
      const inSet   = dimQs.filter(q => qSetIds.has(q.id));
      if (entityType) {
        return inSet.filter(q => {
          const la = Array.isArray(q.level_applicability)
            ? q.level_applicability
            : (q.level_applicability || '').split(',').map(s => s.trim());
          return la.length === 0 || la.includes(entityType);
        });
      }
      return inSet;
    },
    enabled: !!assessment?.question_set?.length && !!dimensionKey,
  });

  const { data: existingResponses = [] } = useQuery({
    queryKey: ['fal-responses-dim', assessmentId, dimensionKey, entityId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getFalResponses', {
        assessment_id: assessmentId,
        dimension_key: dimensionKey,
      });
      const all = res.data?.responses || [];
      if (entityId) return all.filter(r => r.evaluated_entity_id === entityId);
      return all;
    },
    enabled: !!assessmentId && !!dimensionKey,
  });

  const [answers, setAnswers] = useState(/** @type {Record<string, any>} */ ({}));
  const answersRef    = useRef({});
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [swapTarget, setSwapTarget] = useState(null);
  const [swappedIds, setSwappedIds] = useState(new Set());
  const prevResponsesRef = useRef(null);

  // ── Autosave ──────────────────────────────────────────────────────────────
  // Antes, a resposta só era gravada de verdade quando o consultor clicava
  // manualmente em "Salvar" — a % de progresso na tela era só estado local
  // (answersRef), então um F5/fechar aba antes de clicar em "Salvar" perdia
  // tudo, mesmo já tendo "respondido" várias perguntas. handleSaveRef sempre
  // aponta pra versão mais recente de handleSave (evita closure velha no
  // timer de debounce); autoSaveTimerRef debounça pra não salvar a cada
  // tecla digitada na justificativa.
  const handleSaveRef = useRef(null);
  const autoSaveTimerRef = useRef(null);

  useEffect(() => {
    const key = existingResponses.map(r => r.id).join(',');
    if (prevResponsesRef.current === key) return;
    prevResponsesRef.current = key;
    const initial = {};
    existingResponses.forEach(r => {
      initial[r.fal_question_id] = {
        id: r.id,
        score: r.score,
        justification: r.justification || '',
        confidence_level: r.confidence_level || 'auto_declarada',
        flag: r.flag || null,
        evidence_notes: r.evidence_notes || '',
        evidence_file_urls: r.evidence_file_urls || [],
      };
    });
    setAnswers(initial);
    answersRef.current = initial;
    // Navegar para a primeira pergunta sem resposta (igual ao MQE)
    const qs = sortedQuestionsRef.current;
    const firstUnanswered = qs.findIndex(q => initial[q.id]?.score === undefined);
    if (firstUnanswered > 0) setCurrentIndex(firstUnanswered);
  }, [existingResponses]);

  const onAnswer = useCallback((qId, fields) => {
    answersRef.current = { ...answersRef.current, [qId]: { ...answersRef.current[qId], ...fields } };
    setAnswers({ ...answersRef.current });
    setSaved(false);

    // Autosave debounçado — grava de verdade ~1s depois da última mudança,
    // sem precisar do clique manual em "Salvar".
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      handleSaveRef.current?.();
    }, 1000);
  }, []);

  const sortedQuestionsRef = useRef([]);

  const onScoreSelect = useCallback(() => {
    setTimeout(() => {
      setCurrentIndex(i => Math.min(sortedQuestionsRef.current.length - 1, i + 1));
    }, 300);
  }, []);

  // persistAnswers: grava de verdade as respostas pendentes (usado tanto pelo
  // autosave em segundo plano quanto pelo botão manual "Salvar" — só o botão
  // manual navega de volta pro assessment depois; o autosave não navega,
  // senão jogaria o consultor pra fora da tela a cada ~1s enquanto responde.
  const persistAnswers = async () => {
    const effectiveTenantId = tenantId || assessment?.tenant_id || 'global';
    const currentAnswers    = answersRef.current;
    const questionsToSave   = sortedQuestionsRef.current.filter(q => currentAnswers[q.id]?.score !== undefined);

    const saveTasks = questionsToSave.map(q => async () => {
      const ans   = currentAnswers[q.id];
      const score = Math.min(3, Math.max(0, Number(ans.score)));
      const payload = {
        tenant_id: effectiveTenantId, assessment_id: assessmentId,
        fal_question_id: q.id, dimension_key: q.dimension_key,
        subdimension_key: q.subdimension_key, cluster_key: q.cluster_key,
        score, justification: ans.justification || '',
        confidence_level: ans.confidence_level || 'auto_declarada',
        flag: ans.flag || null, evidence_notes: ans.evidence_notes || '',
        evidence_file_urls: ans.evidence_file_urls || [],
        ...(entityId && { evaluated_entity_id: entityId, evaluated_entity_type: entityType || null }),
      };
      if (ans.id) {
        await base44.entities.FalResponse.update(ans.id, {
          score, justification: payload.justification, confidence_level: payload.confidence_level,
          flag: payload.flag, evidence_notes: payload.evidence_notes,
          evidence_file_urls: payload.evidence_file_urls,
        });
      } else {
        const created = await base44.entities.FalResponse.create(payload);
        const updated = { ...answersRef.current, [q.id]: { ...answersRef.current[q.id], id: created.id } };
        answersRef.current = updated;
        setAnswers(updated);
      }
    });

    for (const task of saveTasks) await task();

    const progressRes = await base44.functions.invoke('getFalResponses', { assessment_id: assessmentId });
    const allResponses = progressRes.data?.responses || [];
    const totalQs      = assessment?.question_set?.length || 0;
    const progressPct  = totalQs > 0 ? Math.round((allResponses.length / totalQs) * 100) : 0;
    await base44.entities.Assessment.update(assessmentId, {
      progress_percentage: progressPct,
      last_saved_at: new Date().toISOString(),
      last_subdimension_key: falQuestions[0]?.subdimension_key || null,
    });

    queryClient.invalidateQueries({ queryKey: ['fal-responses-dim', assessmentId, dimensionKey] });
    queryClient.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId, 'fal-responses') });
    queryClient.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId) });
  };

  // Autosave em segundo plano — sem indicador de "saving", sem navegar,
  // sem re-disparar se já houver um autosave em andamento.
  const autoSavingRef = useRef(false);
  const autoSave = async () => {
    if (autoSavingRef.current) return;
    autoSavingRef.current = true;
    try {
      await persistAnswers();
      setSaved(true);
    } catch (e) {
      console.warn('[DimensionQuestionnaire] autosave falhou:', e.message);
    } finally {
      autoSavingRef.current = false;
    }
  };

  useEffect(() => {
    handleSaveRef.current = autoSave;
  });

  // Flush final: tenta salvar qualquer coisa pendente ao sair da tela
  // (trocar de pergunta/dimensão, fechar aba) — best-effort, não bloqueia.
  useEffect(() => () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      persistAnswers().catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setSaving(true);
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    await persistAnswers();
    setSaving(false);
    navigate(createPageUrl(`AssessmentDetail?id=${assessmentId}`));
  };

  const handleSwapConfirmed = ({ originalId, replacementQuestion }) => {
    if (!replacementQuestion) return;
    setSwappedIds(prev => new Set([...prev, originalId]));
    queryClient.invalidateQueries({ queryKey: assessmentKey(tenantId, assessmentId) });
    queryClient.invalidateQueries({ queryKey: ['fal-questions-dim', assessmentId, dimensionKey] });
    setSwapTarget(null);
  };

  const sortedQuestions = useMemo(() => {
    const officialSubdims = getSubdimensionsForDimension(dimensionKey);
    const subdimOrderMap = Object.fromEntries(officialSubdims.map((s, i) => [s.key, i]));

    const clusterOrderMap = {};
    officialSubdims.forEach(sub => {
      const subClusters = getClustersForSubdimension(sub.key);
      subClusters.forEach((c, i) => {
        clusterOrderMap[c.key] = i;
      });
    });

    return [...falQuestions].sort((a, b) => {
      const subA = normalizeSubdimKey(a.subdimension_key) || a.subdimension_key;
      const subB = normalizeSubdimKey(b.subdimension_key) || b.subdimension_key;
      const orderSubA = subdimOrderMap[subA] ?? 999;
      const orderSubB = subdimOrderMap[subB] ?? 999;

      if (orderSubA !== orderSubB) {
        return orderSubA - orderSubB;
      }

      const clusA = normalizeClusterKey(a.cluster_key) || a.cluster_key;
      const clusB = normalizeClusterKey(b.cluster_key) || b.cluster_key;
      const orderClusA = clusterOrderMap[clusA] ?? 999;
      const orderClusB = clusterOrderMap[clusB] ?? 999;

      if (orderClusA !== orderClusB) {
        return orderClusA - orderClusB;
      }

      const stageA = STAGE_ORDER.indexOf(a.process_stage);
      const stageB = STAGE_ORDER.indexOf(b.process_stage);
      const orderStageA = stageA === -1 ? 99 : stageA;
      const orderStageB = stageB === -1 ? 99 : stageB;

      if (orderStageA !== orderStageB) {
        return orderStageA - orderStageB;
      }

      return (a.sequence_order || 0) - (b.sequence_order || 0);
    });
  }, [falQuestions, dimensionKey]);
  sortedQuestionsRef.current = sortedQuestions;

  const questionsBySubdim = useMemo(() => {
    const officialSubdims = getSubdimensionsForDimension(dimensionKey);
    const officialOrder   = Object.fromEntries(officialSubdims.map((s, i) => [s.key, i]));
    const groupMap = {};
    for (const q of sortedQuestions) {
      const rawKey  = q.subdimension_key || '__sem_subdim__';
      const normKey = normalizeSubdimKey(rawKey) || rawKey;
      if (!groupMap[normKey]) groupMap[normKey] = [];
      groupMap[normKey].push(q);
    }
    const subdimLabelMap = Object.fromEntries(FAL_SUBDIMENSIONS.map(s => [s.key, s.label]));
    const formatRawLabel = (key) =>
      key === '__sem_subdim__' ? 'Sem subdimensão' :
      key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return Object.entries(groupMap)
      .map(([normKey, questions]) => ({
        key: normKey, label: subdimLabelMap[normKey] || formatRawLabel(normKey),
        questions, order: officialOrder[normKey] ?? 999,
      }))
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  }, [sortedQuestions, dimensionKey]);

  // score !== undefined cobre score === 0 como resposta válida
  const answeredCount = useMemo(
    () => sortedQuestions.filter(q => answers[q.id]?.score !== undefined).length,
    [sortedQuestions, answers]
  );
  const markedCount = useMemo(
    () => sortedQuestions.filter(q => !!answers[q.id]?.flag).length,
    [sortedQuestions, answers]
  );
  const noEvidence = useMemo(() => sortedQuestions.filter(q => {
    const a = answers[q.id];
    if (!a || a.score === undefined) return false;
    const isCriticalScore = a.score === 0 || a.score === 1;
    const hasFiles        = Array.isArray(a.evidence_file_urls) && a.evidence_file_urls.length > 0;
    const hasNotes        = !!a.evidence_notes?.trim();
    const hasJustif       = !!a.justification?.trim();
    return isCriticalScore && !hasFiles && !hasNotes && !hasJustif;
  }).length, [sortedQuestions, answers]);
  const answeredIndexes = useMemo(() => new Set(
    sortedQuestions.map((q, i) => answers[q.id]?.score !== undefined ? i : null).filter(i => i !== null)
  ), [sortedQuestions, answers]);

  const dimLabel = DIMENSION_LABELS[dimensionKey] || dimensionKey;
  const currentQ      = sortedQuestions[currentIndex];
  const currentSubdim = questionsBySubdim.find(g => g.questions.some(q => q.id === currentQ?.id));

  const navigateToDot = useCallback((i) => { setCurrentIndex(i); }, []);

  const totalQ = sortedQuestions.length;
  const progress = totalQ > 0 ? Math.round((answeredCount / totalQ) * 100) : 0;
  const currentIsAnswered = currentQ && answers[currentQ.id]?.score !== undefined;

  if (!dimensionKey && !assessment) {
    return <div className="p-8 text-center text-slate-500">Carregando questionário...</div>;
  }

  const isMultiEntity = assessment?.assessment_mode === 'fal_scoped' || assessment?.assessment_mode === 'multi_entity_master';
  if (isMultiEntity && !entityId) {
    return (
      <div className="p-8 max-w-lg mx-auto mt-16 text-center">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="text-amber-500 text-4xl mb-3">⚠️</div>
          <h2 className="text-base font-bold text-amber-800 mb-2">Entidade não selecionada</h2>
          <p className="text-sm text-amber-700">Selecione uma entidade antes de responder esta dimensão.</p>
          <Link to={createPageUrl(`AssessmentDetail?id=${assessmentId}`)} className="mt-4 inline-flex items-center gap-2 text-sm text-blue-600 hover:underline">
            <ArrowLeft className="w-4 h-4" /> Voltar e selecionar entidade
          </Link>
        </div>
      </div>
    );
  }

  if (loadingQ) {
    return <div className="p-8 text-center text-slate-500">Carregando perguntas...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Topbar */}
      <div className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center justify-between flex-shrink-0 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to={createPageUrl(`AssessmentDetail?id=${assessmentId}`)}
            className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 font-medium flex-shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </Link>
          <span className="text-slate-200 hidden sm:block">|</span>
          <span className="text-xs text-slate-400 hidden sm:block truncate">
            <strong className="text-slate-700">{dimLabel}</strong>
            {currentSubdim?.label && <> · <span className="text-slate-500">{currentSubdim.label}</span></>}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {saved && (
            <span className="text-xs text-emerald-600 flex items-center gap-1 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Salvo
            </span>
          )}
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs h-8 px-4 gap-1.5"
          >
            {saving ? 'Salvando...' : <><Save className="w-3.5 h-3.5" /> Salvar</>}
          </Button>
        </div>
      </div>

      {/* Corpo */}
      <div className="flex-1 max-w-[1400px] w-full mx-auto px-4 lg:px-6 py-4 flex flex-col gap-4">

        {/* Header + Barra de progresso */}
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex-shrink-0">
          <QuestionnaireHeader title={dimLabel} />
          {totalQ > 0 && (
            <div className="mt-3">
              <QuestionnaireProgressBar
                answered={answeredCount}
                total={totalQ}
                current={currentIndex}
                onNavigate={navigateToDot}
                answeredSet={answeredIndexes}
              />
            </div>
          )}
        </div>

        {/* Grid cockpit */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6 items-start">

          {/* Coluna principal: pergunta (3/4) */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            {totalQ === 0 ? (
              <div className="py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                <p>Nenhuma pergunta FAL encontrada para esta dimensão no question_set.</p>
                <p className="text-xs mt-1">Gere o question_set no painel do assessment.</p>
              </div>
            ) : (
              <QuestionCard
                key={currentQ?.id}
                q={currentQ}
                idx={currentIndex}
                total={totalQ}
                answer={answers[currentQ?.id] || {}}
                onAnswer={(fields) => onAnswer(currentQ?.id, fields)}
                onScoreSelect={currentIndex < totalQ - 1 ? onScoreSelect : undefined}
                swapped={swappedIds.has(currentQ?.id)}
                onSwap={() => setSwapTarget(currentQ)}
              />
            )}

            {/* Navegação inferior */}
            {totalQ > 0 && (
              <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 px-4 py-3">
                <Button
                  variant="outline"
                  onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                  disabled={currentIndex === 0}
                  className="rounded-xl h-8 text-xs font-semibold gap-1"
                >
                  <ChevronLeft className="w-4 h-4" /> Anterior
                </Button>

                <span className="text-xs text-slate-400 font-bold">
                  {currentIndex + 1} / {totalQ}
                </span>

                {currentIndex < totalQ - 1 ? (
                  <Button
                    variant="outline"
                    onClick={() => setCurrentIndex(i => i + 1)}
                    className="rounded-xl h-8 text-xs font-semibold gap-1 text-slate-700"
                  >
                    {!currentIsAnswered ? 'Avançar sem responder' : 'Próxima'}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-8 text-xs font-bold px-4 gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {saving ? 'Salvando...' : 'Salvar e Voltar'}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Barra lateral: cockpit de monitoramento (1/4) */}
          <CockpitSidebar
            sortedQuestions={sortedQuestions}
            answers={answers}
            currentIndex={currentIndex}
            onNavigate={setCurrentIndex}
            progress={progress}
            answeredCount={answeredCount}
            totalQ={totalQ}
            markedCount={markedCount}
            noEvidence={noEvidence}
          />
        </div>
      </div>

      {swapTarget && (
        <SwapQuestionModal
          open={!!swapTarget}
          onClose={() => setSwapTarget(null)}
          question={swapTarget}
          assessmentId={assessmentId}
          onSwapConfirmed={handleSwapConfirmed}
        />
      )}
    </div>
  );
}

const STAGE_ORDER = [
  'existence', 'request', 'analysis', 'approval',
  'execution', 'record', 'control', 'monitoring', 'audit'
];

const DIMENSION_LABELS = {
  governanca:         'Governança',
  juridico:           'Jurídico / Societário',
  controles_internos: 'Controles Internos',
  financeiro:         'Financeiro',
  contabil:           'Contábil',
  tributario:         'Fiscal / Tributário',
  operacional:        'Operacional',
  sistemas:           'Tecnologia / Sistemas',
};