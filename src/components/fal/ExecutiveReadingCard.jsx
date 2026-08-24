/**
 * ExecutiveReadingCard
 * Exibe a Leitura Executiva do Diagnóstico gerada automaticamente pelo motor 8D.
 * A tensão por dimensão é usada como inteligência interna — nunca exibida.
 */
import React, { useMemo } from 'react';
import { BookOpen } from 'lucide-react';
import { deriveNarrativeSignals, generateExecutive8DReading } from './executiveReadingEngine';

/**
 * @param {Object} props
 * @param {any=} props.radarPoints
 * @param {any=} props.dimensionScores
 * @param {any=} props.dimensionRiskSummary
 */
export default function ExecutiveReadingCard({ radarPoints, dimensionScores, dimensionRiskSummary }) {
  // Montar array de dimensões com score e tensão (interna)
  const dimensions = useMemo(() => {
    if (!dimensionScores) return [];
    return Object.entries(dimensionScores)
      .filter(([, v]) => v?.active !== false && v?.score != null)
      .map(([key, val]) => ({
        dimension_key: key,
        score: val.score,
        // tensão = distância entre score da dimensão e score do cluster crítico
        tension: dimensionRiskSummary?.[key]?.critical_cluster_score != null
          ? Math.abs((val.score || 0) - (dimensionRiskSummary[key].critical_cluster_score || 0))
          : null,
      }));
  }, [dimensionScores, dimensionRiskSummary]);

  if (!dimensions.length) return null;

  const signals = deriveNarrativeSignals(dimensions);
  const reading = generateExecutive8DReading(signals, dimensions);

  if (!reading) return null;

  const paragraphs = reading.split('\n\n').filter(Boolean);

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
          Leitura Executiva do Diagnóstico
        </p>
      </div>
      <div className="space-y-3">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-sm text-slate-700 leading-relaxed">{p}</p>
        ))}
      </div>
    </div>
  );
}