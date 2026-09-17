/**
 * ReviewEvolutionChart
 * Gráfico de evolução do IFME™ ao longo das revisões do plano de ação.
 * Marco zero = diagnóstico inicial (FalDiagnosticSnapshot).
 * Pontos subsequentes = cada ActionPlanReview concluída com fal_score_snapshot preenchido.
 */
import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer
} from 'recharts';
import { TrendingUp, TrendingDown, GitBranch } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const LEVEL_BG = {
  Crítico:     'bg-red-100 text-red-700',
  Básico:      'bg-amber-100 text-amber-700',
  Estruturado: 'bg-blue-100 text-blue-700',
  Avançado:    'bg-emerald-100 text-emerald-700',
};

function scoreColor(score) {
  if (score == null) return '#94a3b8';
  if (score < 1)   return '#ef4444';
  if (score < 1.8) return '#f59e0b';
  if (score < 2.5) return '#3b82f6';
  return '#10b981';
}

function CustomDot(props) {
  const { cx, cy, payload } = props;
  const color = scoreColor(payload.score);
  const isBaseline = payload.isBaseline;
  return (
    <g>
      <circle cx={cx} cy={cy} r={isBaseline ? 7 : 6} fill="white" stroke={color} strokeWidth={2.5} />
      {isBaseline && <circle cx={cx} cy={cy} r={3} fill={color} />}
    </g>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.active
 * @param {any=} props.payload
 */
function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[170px]">
      <p className="font-bold text-slate-700 mb-1">
        {d.isBaseline ? '📍 Marco Zero' : `Revisão #${d.reviewNumber}`}
      </p>
      <p className="text-slate-500 mb-2">{d.dateLabel}</p>
      {d.score != null ? (
        <>
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className="text-slate-500">IFME™</span>
            <span className="font-black text-slate-800">{d.score.toFixed(2)}</span>
          </div>
          {d.level && (
            <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${LEVEL_BG[d.level] || 'bg-slate-100 text-slate-500'}`}>
              {d.level}
            </span>
          )}
          {d.delta != null && Math.abs(d.delta) >= 0.01 && (
            <div className={`flex items-center gap-1 mt-1.5 font-bold ${d.delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {d.delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {d.delta > 0 ? '+' : ''}{d.delta.toFixed(2)} vs anterior
            </div>
          )}
        </>
      ) : (
        <p className="text-slate-400 italic">Score não registrado</p>
      )}
      {d.visitType && (
        <p className="text-slate-400 mt-1 text-[10px]">
          {d.visitType === 'final' ? 'Encerramento' : d.visitType === 'extraordinary' ? 'Extraordinária' : 'Periódica'}
        </p>
      )}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.baselineSnapshot
 * @param {any=} props.reviews
 */
export default function ReviewEvolutionChart({ baselineSnapshot, reviews = [] }) {
  // Ordenar revisões concluídas: review_number primário, review_date como fallback
  const completedReviews = [...reviews]
    .filter(r => r.status === 'completed')
    .sort((a, b) => {
      if (a.review_number !== b.review_number) return a.review_number - b.review_number;
      return (a.review_date || '').localeCompare(b.review_date || '');
    });

  // Montar série de dados
  const dataPoints = [];

  // Marco zero: score do diagnóstico inicial
  if (baselineSnapshot) {
    dataPoints.push({
      label: 'D0',
      dateLabel: baselineSnapshot.computed_at
        ? format(new Date(baselineSnapshot.computed_at), "dd/MM/yyyy", { locale: ptBR })
        : 'Diagnóstico inicial',
      score: baselineSnapshot.overall_score ?? null,
      level: baselineSnapshot.overall_level ?? null,
      isBaseline: true,
      reviewNumber: 0,
      delta: null,
      visitType: null,
    });
  }

  // Revisões com snapshot de score
  completedReviews.forEach((rev, idx) => {
    const prevScore = idx === 0
      ? (baselineSnapshot?.overall_score ?? null)
      : completedReviews[idx - 1]?.fal_score_snapshot ?? null;

    const score = rev.fal_score_snapshot ?? null;
    const delta = score != null && prevScore != null ? score - prevScore : null;

    dataPoints.push({
      label: `R${rev.review_number}`,
      dateLabel: rev.review_date
        ? format(new Date(String(rev.review_date).slice(0, 10) + 'T12:00'), "dd/MM/yyyy", { locale: ptBR })
        : `Revisão ${rev.review_number}`,
      score,
      level: rev.fal_level_snapshot ?? null,
      isBaseline: false,
      reviewNumber: rev.review_number,
      delta,
      visitType: rev.visit_type,
    });
  });

  if (dataPoints.length === 0) return null;

  const hasAnyScore = dataPoints.some(d => d.score != null);

  // Score da última revisão com dado
  const last = [...dataPoints].reverse().find(d => d.score != null);
  const baseline = dataPoints[0];
  const totalDelta = last && baseline && last !== baseline && last.score != null && baseline.score != null
    ? last.score - baseline.score : null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <GitBranch className="w-4 h-4 text-indigo-500" />
            <p className="text-sm font-bold text-slate-800">IFME™ registrado por revisão</p>
          </div>
          <p className="text-xs text-slate-400">Marco zero (D0) = diagnóstico inicial · Pontos R = revisões do plano</p>
          <p className="text-[10px] text-amber-600 mt-0.5">⚠ As revisões registram o IFME™ disponível no momento. Para medir evolução real, é necessário novo diagnóstico ou recálculo.</p>
        </div>

        {/* Delta total */}
        {totalDelta != null && (
          <div className={`flex flex-col items-end flex-shrink-0`}>
            <div className={`flex items-center gap-1 font-black text-base ${totalDelta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {totalDelta >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {totalDelta >= 0 ? '+' : ''}{totalDelta.toFixed(2)}
            </div>
            <p className="text-[10px] text-slate-400">variação total</p>
          </div>
        )}
      </div>

      {!hasAnyScore ? (
        <div className="px-5 pb-5">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <p className="text-xs text-amber-700 font-medium">
              O score IFME™ será registrado automaticamente ao concluir cada revisão.
            </p>
            <p className="text-[11px] text-amber-600 mt-1">
              Certifique-se de que o diagnóstico FAL foi gerado antes de concluir a revisão.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Gráfico de linha */}
          <div className="px-2 pb-2">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dataPoints} margin={{ top: 16, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 3]}
                  ticks={[0, 1, 1.8, 2.5, 3]}
                  tick={{ fontSize: 10, fill: '#cbd5e1' }}
                  axisLine={false}
                  tickLine={false}
                />
                {/* Faixas de maturidade como referência */}
                <ReferenceLine y={1}   stroke="#fca5a5" strokeDasharray="4 3" label={{ value: 'Básico', position: 'insideTopRight', fontSize: 9, fill: '#f59e0b' }} />
                <ReferenceLine y={1.8} stroke="#93c5fd" strokeDasharray="4 3" label={{ value: 'Estruturado', position: 'insideTopRight', fontSize: 9, fill: '#3b82f6' }} />
                <ReferenceLine y={2.5} stroke="#6ee7b7" strokeDasharray="4 3" label={{ value: 'Avançado', position: 'insideTopRight', fontSize: 9, fill: '#10b981' }} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={<CustomDot />}
                  activeDot={{ r: 8, fill: '#6366f1', stroke: 'white', strokeWidth: 2 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Lista de pontos */}
          <div className="px-5 pb-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-1">
              {dataPoints.map((d) => (
                <div
                  key={d.label}
                  className={`rounded-xl border px-3 py-2 text-center ${d.isBaseline ? 'border-indigo-200 bg-indigo-50' : 'border-slate-100 bg-slate-50'}`}
                >
                  <p className={`text-[10px] font-bold mb-0.5 ${d.isBaseline ? 'text-indigo-600' : 'text-slate-500'}`}>{d.label}</p>
                  {d.score != null ? (
                    <>
                      <p className="text-base font-black" style={{ color: scoreColor(d.score) }}>{d.score.toFixed(2)}</p>
                      {d.level && (
                        <p className={`text-[9px] font-semibold mt-0.5 ${LEVEL_BG[d.level]?.split(' ')[1] || 'text-slate-500'}`}>{d.level}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-slate-300 italic mt-1">—</p>
                  )}
                  {d.delta != null && Math.abs(d.delta) >= 0.01 && (
                    <div className={`flex items-center justify-center gap-0.5 text-[9px] font-bold mt-0.5 ${d.delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {d.delta > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                      {d.delta > 0 ? '+' : ''}{d.delta.toFixed(2)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}