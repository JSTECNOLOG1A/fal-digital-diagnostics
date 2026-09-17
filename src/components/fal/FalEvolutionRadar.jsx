import React from 'react';
import {
  RadarChart, PolarGrid, PolarAngleAxis,
  Radar, ResponsiveContainer, Tooltip, Legend
} from 'recharts';

const OFFICIAL_ORDER = [
  'governanca', 'juridico', 'controles_internos', 'financeiro',
  'contabil', 'tributario', 'operacional', 'sistemas'
];

const DIM_LABELS = {
  governanca:         'Governança',
  juridico:           'Jurídico',
  controles_internos: 'Controles Int.',
  financeiro:         'Financeiro',
  contabil:           'Contábil',
  tributario:         'Fiscal',
  operacional:        'Operacional',
  sistemas:           'Tecnologia',
};

/**
 * FalEvolutionRadar
 * Props:
 *   firstSnapshot  — FalDiagnosticSnapshot do diagnóstico inicial
 *   latestSnapshot — FalDiagnosticSnapshot do diagnóstico atual
 */
export default function FalEvolutionRadar({ firstSnapshot, latestSnapshot }) {
  if (!firstSnapshot || !latestSnapshot) return null;

  const firstScores  = firstSnapshot.dimension_scores  || {};
  const latestScores = latestSnapshot.dimension_scores || {};

  const dims = OFFICIAL_ORDER.filter(d => firstScores[d] || latestScores[d]);
  if (!dims.length) return null;

  const data = dims.map(d => ({
    axis:    DIM_LABELS[d] || d,
    initial: Number((firstScores[d]?.score  ?? 0).toFixed(2)),
    current: Number((latestScores[d]?.score ?? 0).toFixed(2)),
    fullMark: 3,
    dim: d,
  }));

  /**
   * @param {Object} props
   * @param {any=} props.active
   * @param {any=} props.payload
   * @param {any=} props.label
   */
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const entry = data.find(d => d.axis === label);
    const delta = entry ? (entry.current - entry.initial) : null;
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-md p-3 text-xs space-y-1">
        <p className="font-semibold text-slate-800">{label}</p>
        {payload.map(p => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: {Number(p.value).toFixed(2)}
          </p>
        ))}
        {delta != null && (
          <p className={`pt-1 border-t border-slate-100 font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            Variação: {delta >= 0 ? '+' : ''}{delta.toFixed(2)}
          </p>
        )}
      </div>
    );
  };

  // Evolution legend table
  const legendRows = dims.map(d => ({
    label:   DIM_LABELS[d] || d,
    initial: firstScores[d]?.score  ?? 0,
    current: latestScores[d]?.score ?? 0,
    delta:   (latestScores[d]?.score ?? 0) - (firstScores[d]?.score ?? 0),
  }));

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={340}>
        <RadarChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }} />

          {/* Diagnóstico inicial — azul */}
          <Radar
            name="Diagnóstico Inicial"
            dataKey="initial"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.15}
            strokeWidth={1.5}
            strokeDasharray="5 3"
          />

          {/* Situação atual — verde */}
          <Radar
            name="Situação Atual"
            dataKey="current"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.25}
            strokeWidth={2}
          />

          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="line"
            iconSize={16}
            formatter={(v) => <span className="text-xs text-slate-600">{v}</span>}
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Evolution table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-800">
              <th className="text-left py-2 px-3 text-white font-semibold uppercase tracking-wide">Dimensão</th>
              <th className="text-center py-2 px-3 text-white font-semibold">Inicial</th>
              <th className="text-center py-2 px-3 text-white font-semibold">Atual</th>
              <th className="text-center py-2 px-3 text-white font-semibold">Variação</th>
            </tr>
          </thead>
          <tbody>
            {legendRows.map(row => (
              <tr key={row.label} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="py-2 px-3 text-slate-700 font-medium">{row.label}</td>
                <td className="py-2 px-3 text-center text-blue-600 tabular-nums">{row.initial.toFixed(2)}</td>
                <td className="py-2 px-3 text-center text-emerald-600 tabular-nums">{row.current.toFixed(2)}</td>
                <td className={`py-2 px-3 text-center font-bold tabular-nums ${row.delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {row.delta >= 0 ? '+' : ''}{row.delta.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}