/**
 * DimensionEvolutionChart
 * Gráfico de evolução por dimensão ao longo das revisões do plano de ação.
 * Marco zero = FalDiagnosticSnapshot (dimension_scores).
 * Pontos subsequentes = cada ActionPlanReview com fal_dimension_scores_snapshot preenchido.
 */
import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ReferenceLine, ResponsiveContainer
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { GitBranch, Loader2, TrendingUp } from 'lucide-react';

const DIM_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'
];

/**
 * @param {Object} props
 * @param {any=} props.active
 * @param {any=} props.payload
 * @param {any=} props.label
 */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[190px]">
      <p className="font-bold text-slate-700 mb-1">
        {d?.isBaseline ? '📍 Marco Zero' : `Revisão #${d?.reviewNumber}`}
      </p>
      <p className="text-slate-400 mb-2">{d?.dateLabel}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-3 mb-0.5">
          <span style={{ color: entry.stroke }} className="font-medium truncate max-w-[110px]">{entry.name}</span>
          <span className="font-black text-slate-800">
            {(() => {
              const v = typeof entry.value === 'object' && entry.value !== null
                ? (entry.value.score ?? entry.value.value ?? null)
                : entry.value;
              return v != null ? Number(v).toFixed(2) : '—';
            })()}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.assessmentId
 * @param {any=} props.planId
 * @param {any=} props.reviews
 */
export default function DimensionEvolutionChart({ assessmentId, planId, reviews = [] }) {
  // Buscar nomes das dimensões
  const { data: falDimensions = [] } = useQuery({
    queryKey: ['fal-dimensions'],
    queryFn: () => base44.entities.FalDimension.list(),
    staleTime: 60 * 60_000,
  });

  const dimNames = React.useMemo(() => {
    return falDimensions.reduce((acc, d) => { acc[d.key] = d.name; return acc; }, {});
  }, [falDimensions]);

  // Buscar snapshot inicial (marco zero)
  const { data: baselineSnapshot, isLoading: loadingBaseline } = useQuery({
    queryKey: ['fal-snapshot-baseline', assessmentId],
    queryFn: async () => {
      const snaps = await base44.entities.FalDiagnosticSnapshot.filter({ assessment_id: assessmentId }, '-computed_at', 1);
      return snaps[0] || null;
    },
    enabled: !!assessmentId,
    staleTime: 5 * 60_000,
  });

  // Montar pontos de dados
  const { dataPoints, dimensions } = React.useMemo(() => {
    const points = [];
    const dimsSet = new Set();

    const normalizeScores = (scores) => {
      const out = {};
      Object.entries(scores).forEach(([k, v]) => {
        if (typeof v === 'object' && v !== null) {
          out[k] = v.score ?? v.value ?? null;
        } else {
          out[k] = v != null ? Number(v) : null;
        }
      });
      return out;
    };

    // Marco zero
    if (baselineSnapshot?.dimension_scores) {
      const scores = normalizeScores(baselineSnapshot.dimension_scores);
      Object.keys(scores).forEach(k => dimsSet.add(k));
      points.push({
        label: 'D0',
        dateLabel: baselineSnapshot.computed_at
          ? format(new Date(baselineSnapshot.computed_at), 'dd/MM/yyyy', { locale: ptBR })
          : 'Diagnóstico inicial',
        isBaseline: true,
        reviewNumber: 0,
        ...scores,
      });
    }

    // Revisões concluídas com snapshot de dimensões
    const completed = [...reviews]
      .filter(r => r.status === 'completed' && r.fal_dimension_scores_snapshot)
      .sort((a, b) => (a.review_number || 0) - (b.review_number || 0));

    completed.forEach(rev => {
      const scores = normalizeScores(rev.fal_dimension_scores_snapshot);
      Object.keys(scores).forEach(k => dimsSet.add(k));
      points.push({
        label: `R${rev.review_number}`,
        dateLabel: rev.review_date
          ? format(new Date(String(rev.review_date).slice(0, 10) + 'T12:00'), 'dd/MM/yyyy', { locale: ptBR })
          : `Revisão ${rev.review_number}`,
        isBaseline: false,
        reviewNumber: rev.review_number,
        ...scores,
      });
    });

    return { dataPoints: points, dimensions: Array.from(dimsSet) };
  }, [baselineSnapshot, reviews]);

  if (loadingBaseline) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando evolução...
      </div>
    );
  }

  if (dataPoints.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
        <GitBranch className="w-8 h-8 mx-auto mb-3 text-slate-300" />
        <p className="text-sm font-semibold text-slate-500">Nenhum dado de evolução disponível.</p>
        <p className="text-xs text-slate-400 mt-1">O gráfico será populado após revisões concluídas com scores de dimensão.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            <p className="text-sm font-bold text-slate-800">Evolução por Dimensão FAL</p>
          </div>
          <p className="text-xs text-slate-400">Marco zero (D0) = diagnóstico inicial · Pontos R = revisões do plano</p>
        </div>
        <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-500 flex-shrink-0">
          {dataPoints.length} pontos
        </span>
      </div>

      {/* Gráfico */}
      <div className="px-2 pb-4">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={dataPoints} margin={{ top: 10, right: 24, left: -10, bottom: 0 }}>
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
            <ReferenceLine y={1}   stroke="#fca5a5" strokeDasharray="4 3" label={{ value: 'Básico',      position: 'insideTopRight', fontSize: 9, fill: '#f59e0b' }} />
            <ReferenceLine y={1.8} stroke="#93c5fd" strokeDasharray="4 3" label={{ value: 'Estruturado', position: 'insideTopRight', fontSize: 9, fill: '#3b82f6' }} />
            <ReferenceLine y={2.5} stroke="#6ee7b7" strokeDasharray="4 3" label={{ value: 'Avançado',    position: 'insideTopRight', fontSize: 9, fill: '#10b981' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
              formatter={(value) => dimNames[value] || value}
            />
            {dimensions.map((dimKey, idx) => (
              <Line
                key={dimKey}
                type="monotone"
                dataKey={dimKey}
                name={dimNames[dimKey] || dimKey}
                stroke={DIM_COLORS[idx % DIM_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 4, fill: 'white', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}