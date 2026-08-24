import React from 'react';

/**
 * QuestionnaireProgressBar — Barra de progresso + bolinhas de navegação interativa.
 * Props:
 *   answered      — número de perguntas respondidas
 *   total         — total de perguntas
 *   current       — índice atual
 *   onNavigate    — (i: number) => void — ao clicar em uma bolinha
 *   answeredSet   — Set<number> com índices respondidos (opcional; fallback por contagem)
 */
export default function QuestionnaireProgressBar({ answered, total, current, onNavigate, answeredSet }) {
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

  return (
    <div className="mb-4">
      {/* Linha de texto */}
      <div className="flex items-center gap-3 mb-1.5">
        <span className="text-xs font-semibold text-slate-700">
          {answered}/{total} respondidas
        </span>
        <span className="text-xs font-bold text-blue-700">{pct}%</span>
      </div>

      {/* Barra de progresso */}
      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #1e3a5f 0%, #2563eb 100%)',
          }}
        />
      </div>

      {/* Bolinhas de navegação */}
      {total > 0 && onNavigate && (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: total }).map((_, i) => {
            const isCurrent  = i === current;
            const isAnswered = answeredSet ? answeredSet.has(i) : i < answered;

            return (
              <button
                key={i}
                title={`Pergunta ${i + 1}`}
                onClick={() => onNavigate(i)}
                className={`rounded-full transition-all duration-200 focus:outline-none flex-shrink-0
                  ${isCurrent
                    ? 'w-4 h-4 bg-emerald-500 ring-2 ring-emerald-300 ring-offset-1 animate-pulse'
                    : isAnswered
                      ? 'w-3 h-3 bg-blue-500 hover:bg-blue-600'
                      : 'w-3 h-3 bg-slate-300 hover:bg-slate-400'
                  }`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}