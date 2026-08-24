import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ChevronRight, AlertTriangle, CheckCircle2, Circle, ExternalLink, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const LEVEL_STYLE = {
  Avançado:    { bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', dot: 'text-emerald-500' },
  Estruturado: { bar: 'bg-blue-500',    badge: 'bg-blue-100 text-blue-700',    dot: 'text-blue-500' },
  Básico:      { bar: 'bg-amber-400',   badge: 'bg-amber-100 text-amber-700',  dot: 'text-amber-500' },
  Crítico:     { bar: 'bg-red-500',     badge: 'bg-red-100 text-red-700',      dot: 'text-red-500' },
};

function scoreToLevel(score) {
  if (score >= 2.5) return 'Avançado';
  if (score >= 1.7) return 'Estruturado';
  if (score >= 0.8) return 'Básico';
  return 'Crítico';
}

/**
 * @param {Object} props
 * @param {any=} props.cross
 * @param {any=} props.questions
 * @param {any=} props.responses
 * @param {any=} props.assessmentId
 */
function CrossingCard({ cross, questions, responses, assessmentId }) {
  const [expanded, setExpanded] = useState(false);

  const total     = questions.length;
  const answered  = responses.length;
  const pct       = total > 0 ? Math.round((answered / total) * 100) : 0;
  const complete  = total > 0 && answered >= total;
  const unanswered = total - answered;

  // Score médio das respostas (escala 0–3)
  const avgScore = answered > 0
    ? responses.reduce((s, r) => s + (r.score || 0), 0) / answered
    : null;
  const normalizedScore = avgScore != null ? Math.round(avgScore * 100) / 100 : null;
  const level = normalizedScore != null ? scoreToLevel(normalizedScore) : null;
  const style = level ? LEVEL_STYLE[level] : null;

  // Detectar conflito: diferença de 2+ pontos entre min e max (em escala 0–3)
  const hasConflict = answered >= 3 && (() => {
    const scores = responses.map(r => r.score || 0);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    return max - min >= 2;
  })();

  // Principais achados: respostas com score 0 com justificativa
  const criticalFindings = responses
    .filter(r => r.score === 0 && r.justification)
    .slice(0, 2);

  return (
    <div className={`rounded-xl border shadow-sm overflow-hidden bg-white transition-all ${complete ? 'border-emerald-200' : 'border-slate-200'}`}>
      {/* Header clicável para expandir */}
      <button
        className="w-full text-left p-4"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          {/* Status icon */}
          <div className="flex-shrink-0">
            {complete
              ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              : answered > 0
              ? <Circle className="w-5 h-5 text-amber-400" />
              : <Circle className="w-5 h-5 text-slate-300" />}
          </div>

          {/* Name + badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-slate-800">{cross.name}</p>
              {hasConflict && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-semibold">
                  <AlertTriangle className="w-2.5 h-2.5" /> Conflito detectado
                </span>
              )}
              {level && style && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${style.badge}`}>
                  {level}
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${style?.bar || 'bg-slate-300'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400 flex-shrink-0">{answered}/{total}</span>
            </div>
          </div>

          {/* Score ou pendências */}
          <div className="flex-shrink-0 text-right">
            {normalizedScore != null ? (
              <p className={`text-lg font-bold ${style?.dot || 'text-slate-500'}`}>
                {normalizedScore.toFixed(2)}
              </p>
            ) : unanswered > 0 ? (
              <p className="text-xs text-slate-400">{unanswered} pendente{unanswered > 1 ? 's' : ''}</p>
            ) : null}
          </div>

          <ChevronRight className={`w-4 h-4 text-slate-300 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {/* Expanded: achados + botão de abrir */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
          {criticalFindings.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Achados críticos</p>
              {criticalFindings.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-600 bg-red-50 border border-red-100 rounded-lg p-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-2">{r.justification}</span>
                </div>
              ))}
            </div>
          )}

          {!complete && unanswered > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span><strong>{unanswered}</strong> pergunta{unanswered > 1 ? 's' : ''} ainda não respondida{unanswered > 1 ? 's' : ''} neste cruzamento.</span>
            </div>
          )}

          {complete && criticalFindings.length === 0 && !hasConflict && (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              ✓ Cruzamento concluído sem achados críticos.
            </p>
          )}

          <Link
            to={createPageUrl(`CrossingQuestionnaire?assessment_id=${assessmentId}&crossing=${cross.key}`)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {complete ? 'Revisar análise do cruzamento' : 'Abrir análise do cruzamento'}
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.assessmentId
 * @param {any=} props.crossings
 * @param {any=} props.methodVersionId
 * @param {any=} props.tenantId
 * @param {any=} props.activeDimensions
 */
export default function CrossingProgress({ assessmentId, crossings, methodVersionId, tenantId, activeDimensions = [] }) {
  const { data: mqeQuestions = [] } = useQuery({
    queryKey: ['mqe-questions', methodVersionId],
    queryFn: () => base44.entities.MQEQuestion.filter({ method_version_id: methodVersionId }),
    enabled: !!methodVersionId,
  });

  const { data: mqeResponses = [] } = useQuery({
    queryKey: ['mqe-responses', assessmentId],
    queryFn: () => base44.entities.MQEResponse.filter({ assessment_id: assessmentId }),
    enabled: !!assessmentId,
  });

  // Filtrar cruzamentos apenas para dimensões ativas
  const activeDimensionsSet = new Set(activeDimensions);
  const visibleCrossings = crossings.filter(c => 
    activeDimensionsSet.has(c.dim_a) && activeDimensionsSet.has(c.dim_b)
  );

  const totalQ = mqeQuestions.length;
  const totalR = mqeResponses.length;
  const globalPct = totalQ > 0 ? Math.round((totalR / totalQ) * 100) : 0;
  const completedCrossings = visibleCrossings.filter(c => {
    const cQ = mqeQuestions.filter(q => q.crossing_key === c.key).length;
    const cR = mqeResponses.filter(r => r.crossing_key === c.key).length;
    return cQ > 0 && cR >= cQ;
  }).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-700">MQE™ — Método de Qualificação da Estrutura</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-slate-400 hover:text-slate-600">
                  <Info className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs leading-relaxed">
                O MQE qualifica a estrutura de integração entre pares de dimensões organizacionais. Enquanto o IFME™ mede o que cada dimensão tem individualmente, o MQE avalia o quão bem elas conversam entre si na prática — alimentando o cálculo do MFIS™ com dados reais de interdependência.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <span className="text-xs text-slate-400">
          {completedCrossings}/{visibleCrossings.length} concluídos · {globalPct}%
        </span>
      </div>

      {visibleCrossings.map(cross => (
        <CrossingCard
          key={cross.key}
          cross={cross}
          questions={mqeQuestions.filter(q => q.crossing_key === cross.key)}
          responses={mqeResponses.filter(r => r.crossing_key === cross.key)}
          assessmentId={assessmentId}
        />
      ))}
    </div>
  );
}