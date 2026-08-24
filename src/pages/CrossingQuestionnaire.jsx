import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '@/components/shared/TenantContext';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, CheckCircle2, Info, Save, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { invalidateAssessmentQueries } from '@/lib/query-client';
import ScoreSelector from '@/components/shared/questionnaire/ScoreSelector';
import QuestionnaireProgressBar from '@/components/shared/questionnaire/QuestionnaireProgressBar';
import QuestionnaireHeader from '@/components/shared/questionnaire/QuestionnaireHeader';

export default function CrossingQuestionnaire() {
  const params       = new URLSearchParams(window.location.search);
  const assessmentId = params.get('assessment_id');
  const crossingKey  = params.get('crossing');
  const { user, methodVersion } = useTenant();
  const queryClient  = useQueryClient();
  const navigate     = useNavigate();

  const crossing = methodVersion?.crossings?.find(c => c.key === crossingKey);

  const { data: assessment } = useQuery({
    queryKey: ['assessment-sector', assessmentId],
    queryFn:  () => base44.entities.Assessment.get(assessmentId),
    enabled:  !!assessmentId,
  });
  const sectorSnapshot = assessment?.sector_snapshot?.length ? assessment.sector_snapshot : ['general_business'];

  const { data: allQuestions = [] } = useQuery({
    queryKey: ['mqe-q', methodVersion?.id, crossingKey],
    queryFn:  () => base44.entities.MQEQuestion.filter({ method_version_id: methodVersion.id, crossing_key: crossingKey }),
    enabled:  !!methodVersion?.id && !!crossingKey,
  });

  const questions = allQuestions.filter(q => {
    if (!q.sector_type && !q.is_core && !q.is_optional && (!q.sector_tags || q.sector_tags.length === 0)) return true;
    const sType = q.sector_type || (q.is_core ? 'core' : q.is_optional ? 'optional' : 'sector');
    if (sType === 'optional') return false;
    if (sType === 'core') return true;
    const tags = q.sector_tags || [];
    return tags.some(t => sectorSnapshot.includes(t));
  });

  const sortedQ = useMemo(
    () => [...questions].sort((a, b) => (a.order || 0) - (b.order || 0)),
    [questions]
  );

  const { data: existingResponses = [] } = useQuery({
    queryKey: ['mqe-r', assessmentId, crossingKey],
    queryFn:  () => base44.entities.MQEResponse.filter({ assessment_id: assessmentId, crossing_key: crossingKey }),
    enabled:  !!assessmentId && !!crossingKey,
  });

  const [answers, setAnswers]       = useState(/** @type {Record<string, any>} */ ({}));
  const [currentIdx, setCurrentIdx] = useState(0);
  const [saving, setSaving]         = useState(false);
  const [showGuidance, setShowGuidance] = useState(false);
  const prevKeyRef = useRef(null);

  useEffect(() => {
    const key = existingResponses.map(r => r.id).join(',');
    if (prevKeyRef.current === key) return;
    prevKeyRef.current = key;
    const initial = {};
    existingResponses.forEach(r => {
      initial[r.mqe_question_id] = {
        score: r.score, justification: r.justification || '',
        divergence_notes: r.divergence_notes || '', id: r.id,
      };
    });
    setAnswers(initial);
    const firstUnanswered = sortedQ.findIndex(q => initial[q.id]?.score === undefined);
    if (firstUnanswered !== -1) setCurrentIdx(firstUnanswered);
  }, [existingResponses]);

  useEffect(() => { setShowGuidance(false); }, [currentIdx]);

  const updateAnswer = useCallback((qId, fields) => {
    setAnswers(prev => ({ ...prev, [qId]: { ...prev[qId], ...fields } }));
  }, []);

  const handleScoreSelect = (score) => {
    const q = sortedQ[currentIdx];
    if (!q) return;
    updateAnswer(q.id, { score });
    setTimeout(() => {
      if (currentIdx < sortedQ.length - 1) setCurrentIdx(i => i + 1);
    }, 300);
  };

  const handleSaveAndBack = async () => {
    setSaving(true);
    const tenantId = methodVersion?.tenant_id || assessment?.tenant_id || 'global';
    for (const q of sortedQ) {
      const ans = answers[q.id];
      if (ans?.score === undefined) continue;
      const score = Math.min(3, Math.max(0, Number(ans.score)));
      if (ans.id) {
        await base44.entities.MQEResponse.update(ans.id, {
          score, justification: ans.justification || '', divergence_notes: ans.divergence_notes || '',
        });
      } else {
        const created = await base44.entities.MQEResponse.create({
          tenant_id: tenantId, assessment_id: assessmentId, mqe_question_id: q.id,
          crossing_key: crossingKey, score, justification: ans.justification || '',
          divergence_notes: ans.divergence_notes || '',
        });
        setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], id: created.id } }));
      }
    }
    invalidateAssessmentQueries(queryClient, assessmentId, user?.tenant_id);
    setSaving(false);
    navigate(createPageUrl(`AssessmentDetail?id=${assessmentId}`), { state: { tab: 'mqe' } });
  };

  if (sortedQ.length === 0) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center text-slate-400 gap-3">
        <p className="text-sm">Nenhuma pergunta MQE encontrada para este cruzamento.</p>
        <button onClick={() => navigate(-1)} className="text-xs text-blue-500 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar
        </button>
      </div>
    );
  }

  const q             = sortedQ[currentIdx];
  const answer        = answers[q?.id] || {};
  const totalQ        = sortedQ.length;
  // score !== undefined cobre score === 0 como resposta válida
  const answeredCount = sortedQ.filter(qi => answers[qi.id]?.score !== undefined).length;
  const allAnswered   = answeredCount === totalQ;
  const progress      = totalQ > 0 ? Math.round((answeredCount / totalQ) * 100) : 0;
  const needsJustification = answer.score !== undefined && answer.score <= 1 && !answer.justification?.trim();
  const currentIsAnswered  = answer.score !== undefined;

  const answeredIndexes = new Set(
    sortedQ.map((qi, i) => answers[qi.id]?.score !== undefined ? i : null).filter(i => i !== null)
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Topbar */}
      <div className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center justify-between flex-shrink-0 sticky top-0 z-10 shadow-sm">
        <button
          onClick={() => navigate(createPageUrl(`AssessmentDetail?id=${assessmentId}`))}
          className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao MQE
        </button>
        <button
          onClick={handleSaveAndBack}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? 'Salvando...' : 'Salvar e Voltar'}
        </button>
      </div>

      {/* Corpo */}
      <div className="flex-1 max-w-[1400px] w-full mx-auto px-4 lg:px-6 py-4 flex flex-col gap-4">

        {/* Header + progresso */}
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex-shrink-0">
          <QuestionnaireHeader title={crossing?.name || crossingKey} subtitle="MQE™ — Questionário de Cruzamento" />
          <div className="mt-3">
            <QuestionnaireProgressBar
              answered={answeredCount}
              total={totalQ}
              current={currentIdx}
              onNavigate={setCurrentIdx}
              answeredSet={answeredIndexes}
            />
          </div>
        </div>

        {/* Grid cockpit */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6 items-start">

          {/* Coluna principal: pergunta (3/4) */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-5">

              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                <span className="text-xs text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-lg">
                  Pergunta {currentIdx + 1} de {totalQ}
                </span>
              </div>

              <div className="mb-5">
                <h2 className="text-base lg:text-lg font-bold text-slate-900 leading-snug">
                  {q.text}
                </h2>
                {q.guidance && (
                  <div className="mt-2">
                    <button
                      onClick={() => setShowGuidance(g => !g)}
                      className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-semibold"
                    >
                      <Info className="w-3.5 h-3.5" />
                      {showGuidance ? 'Ocultar orientação' : 'Por que importa?'}
                    </button>
                    {showGuidance && (
                      <div className="mt-2 p-2.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800 leading-relaxed">
                        {q.guidance}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mb-5">
                <ScoreSelector value={answer.score} onChange={handleScoreSelect} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Justificativa
                    {needsJustification && <span className="text-red-500 font-bold ml-1">* obrigatória</span>}
                  </label>
                  <div className="relative">
                    <Textarea
                      placeholder="Fundamente a adequação do cruzamento..."
                      value={answer.justification || ''}
                      onChange={e => updateAnswer(q.id, { justification: e.target.value })}
                      className={`min-h-[68px] text-xs resize-none pr-10 rounded-xl ${
                        needsJustification ? 'border-red-300 ring-1 ring-red-100' : 'border-slate-200'
                      }`}
                      maxLength={2000}
                    />
                    <span className="absolute bottom-2 right-2.5 text-[9px] text-slate-400 pointer-events-none">
                      {(answer.justification || '').length}/2k
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Notas de Divergência</label>
                  <Textarea
                    placeholder="Contradições entre fontes..."
                    value={answer.divergence_notes || ''}
                    onChange={e => updateAnswer(q.id, { divergence_notes: e.target.value })}
                    className="min-h-[68px] text-xs resize-none border-slate-200 rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* Navegação inferior */}
            <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 px-4 py-3">
              <button
                onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                disabled={currentIdx === 0}
                className="flex items-center gap-1.5 px-3 h-8 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>

              <span className="text-xs text-slate-400 font-bold">
                {currentIdx + 1} / {totalQ}
              </span>

              {currentIdx < totalQ - 1 ? (
                <button
                  onClick={() => setCurrentIdx(i => i + 1)}
                  className="flex items-center gap-1.5 px-3 h-8 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {!currentIsAnswered ? 'Avançar sem responder' : 'Próxima'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSaveAndBack}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {saving ? 'Salvando...' : 'Salvar e Voltar'}
                </button>
              )}
            </div>
          </div>

          {/* Barra lateral: cockpit MQE (1/4) */}
          <div className="lg:col-span-1 flex flex-col gap-4 lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto lg:pr-1">

            {/* Card Resumo do Cruzamento */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 text-xs">
              <h3 className="font-bold text-slate-800 text-sm mb-3">Resumo</h3>
              <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Progresso</span>
                  <span className="font-bold text-slate-800">{progress}%</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Avaliados</span>
                  <span className="font-bold text-slate-800">{answeredCount} / {totalQ}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Pendentes</span>
                  <span className={`font-bold ${totalQ - answeredCount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                    {totalQ - answeredCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Card Pendências Clicáveis */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col max-h-80">
              <h4 className="font-bold text-slate-800 text-xs mb-2 flex-shrink-0">Pendências</h4>
              <div className="overflow-y-auto flex-1 space-y-1 pr-0.5">
                {allAnswered ? (
                  <p className="text-emerald-600 font-bold text-[11px] text-center py-4">✓ Cruzamento completo!</p>
                ) : (
                  sortedQ.map((question, qIdx) => {
                    if (answers[question.id]?.score !== undefined) return null;
                    const isActive = currentIdx === qIdx;
                    return (
                      <button
                        key={question.id}
                        onClick={() => setCurrentIdx(qIdx)}
                        className={`w-full text-left px-2 py-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 transition-all ${
                          isActive
                            ? 'bg-amber-50 border-amber-200 text-amber-800 font-bold'
                            : 'bg-white border-transparent text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                        <span className="truncate flex-1">Q{qIdx + 1}. {question.text}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}