/**
 * CockpitSidebar — Barra lateral de monitoramento do cockpit FAL.
 * Exibe métricas em tempo real e atalhos de navegação clicáveis.
 */
import React from 'react';

/**
 * @param {Object} props
 * @param {any=} props.sortedQuestions
 * @param {any=} props.answers
 * @param {any=} props.currentIndex
 * @param {any=} props.onNavigate
 * @param {any=} props.progress
 * @param {any=} props.answeredCount
 * @param {any=} props.totalQ
 * @param {any=} props.markedCount
 * @param {any=} props.noEvidence
 */
export default function CockpitSidebar({
  sortedQuestions,
  answers,
  currentIndex,
  onNavigate,
  progress,
  answeredCount,
  totalQ,
  markedCount,
  noEvidence,
}) {
  const pendingQuestions = sortedQuestions.filter(q => answers[q.id]?.score === undefined);
  const markedQuestions  = sortedQuestions.filter(q => !!answers[q.id]?.flag);

  return (
    <div className="lg:col-span-1 flex flex-col gap-4 lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto lg:pr-1">

      {/* Card Métricas */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 text-xs">
        <h3 className="font-bold text-slate-800 text-sm mb-3">Painel de Métricas</h3>
        <div className="space-y-2">
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500">Progresso</span>
            <span className="font-bold text-slate-800">{progress}%</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500">Respondidas</span>
            <span className="font-bold text-slate-800">{answeredCount} / {totalQ}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500">Pendentes</span>
            <span className={`font-bold ${totalQ - answeredCount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
              {totalQ - answeredCount}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500">Marcadas</span>
            <span className={`font-bold ${markedCount > 0 ? 'text-blue-600' : 'text-slate-800'}`}>
              {markedCount}
            </span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-500">Sem evidência</span>
            <span className={`font-bold ${noEvidence > 0 ? 'text-red-500' : 'text-slate-800'}`}>
              {noEvidence}
            </span>
          </div>
        </div>
      </div>

      {/* Card Perguntas Marcadas */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col max-h-48">
        <h4 className="font-bold text-slate-800 text-xs mb-2 flex-shrink-0">Perguntas Marcadas</h4>
        <div className="overflow-y-auto flex-1 space-y-1 pr-0.5">
          {markedQuestions.length === 0 ? (
            <p className="text-slate-400 italic text-[11px] text-center py-3">Nenhuma marcada.</p>
          ) : (
            markedQuestions.map((question) => {
              const qIdx = sortedQuestions.indexOf(question);
              const ans  = answers[question.id];
              const isActive = currentIndex === qIdx;
              return (
                <button
                  key={question.id}
                  onClick={() => onNavigate(qIdx)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 transition-all ${
                    isActive
                      ? 'bg-blue-50 border-blue-200 text-blue-800 font-bold'
                      : 'bg-white border-transparent text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className={`text-[8px] uppercase font-black px-1 py-0.5 rounded flex-shrink-0 ${
                    ans.flag === 'conflito' ? 'bg-red-100 text-red-600'
                    : ans.flag === 'revisar' ? 'bg-blue-100 text-blue-600'
                    : 'bg-orange-100 text-orange-600'
                  }`}>{ans.flag}</span>
                  <span className="truncate flex-1">Q{qIdx + 1}. {question.question_text}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Card Pendências */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col max-h-60">
        <h4 className="font-bold text-slate-800 text-xs mb-2 flex-shrink-0">Pendências</h4>
        <div className="overflow-y-auto flex-1 space-y-1 pr-0.5">
          {answeredCount === totalQ ? (
            <p className="text-emerald-600 font-bold text-[11px] text-center py-4">✓ Dimensão completa!</p>
          ) : (
            pendingQuestions.map((question) => {
              const qIdx = sortedQuestions.indexOf(question);
              const isActive = currentIndex === qIdx;
              return (
                <button
                  key={question.id}
                  onClick={() => onNavigate(qIdx)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 transition-all ${
                    isActive
                      ? 'bg-amber-50 border-amber-200 text-amber-800 font-bold'
                      : 'bg-white border-transparent text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                  <span className="truncate flex-1">Q{qIdx + 1}. {question.question_text}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}