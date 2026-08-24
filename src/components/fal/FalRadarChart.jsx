/**
 * FalRadarChart.jsx
 * Radar octogonal de maturidade FAL — 8 dimensões.
 * Interação: clique em eixo abre painel lateral com clusters da dimensão.
 */
import React, { useState } from 'react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts';
import { X, AlertTriangle } from 'lucide-react';

const OFFICIAL_ORDER = [
  'governanca', 'juridico', 'controles_internos', 'financeiro',
  'contabil', 'tributario', 'operacional', 'sistemas',
];

const DIM_LABELS = {
  governanca:         'Governança',
  juridico:           'Jurídico / Soc.',
  controles_internos: 'Controles Int.',
  financeiro:         'Financeiro',
  contabil:           'Contábil',
  tributario:         'Fiscal',
  operacional:        'Operacional',
  sistemas:           'Tecnologia',
};

const LEVEL_COLORS = {
  'Crítico':     '#ef4444',
  'Básico':      '#f59e0b',
  'Estruturado': '#3b82f6',
  'Avançado':    '#10b981',
};

function formatKey(key = '') {
  return key.replace(/_cluster$/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Painel lateral de dimensão ─────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.dimKey
 * @param {any=} props.dimData
 * @param {any=} props.radarPoints
 * @param {any=} props.dimensionRiskSummary
 * @param {any=} props.onClose
 */
function DimensionDetailPanel({ dimKey, dimData, radarPoints, dimensionRiskSummary, onClose }) {
  if (!dimKey) return null;

  const point  = radarPoints?.find(p => p.dimension === dimKey);
  const risk   = dimensionRiskSummary?.[dimKey];
  const score  = point?.active === false ? null : (point?.score ?? null);
  const label  = DIM_LABELS[dimKey] || dimKey;
  const level  = point?.level;
  const levelColor = LEVEL_COLORS[level] || '#64748b';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white shadow-2xl flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b bg-slate-50">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Dimensão</p>
            <h3 className="text-base font-bold text-slate-900 mt-0.5">{label}</h3>
            {score !== null && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl font-bold" style={{ color: levelColor }}>{score?.toFixed(2)}</span>
                <span className="text-sm text-slate-400">/3.00</span>
                {level && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: levelColor + '20', color: levelColor }}>
                    {level}
                  </span>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors mt-0.5">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 p-5 space-y-4">
          {/* Cluster crítico da dimensão */}
          {risk?.critical_cluster_key && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wider">Cluster Crítico</p>
              </div>
              <p className="text-sm font-semibold text-slate-800">{formatKey(risk.critical_cluster_key)}</p>
              {risk.critical_cluster_score !== undefined && (
                <p className="text-xs text-red-600 mt-0.5">Score: {risk.critical_cluster_score?.toFixed(2)} / 3.00</p>
              )}
            </div>
          )}

          {/* Score dimension vs risco */}
          {risk && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-slate-400 mb-1">Score Dimensão</p>
                <p className="text-xl font-bold text-slate-900">{risk.dimension_score?.toFixed(2) ?? '—'}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-slate-400 mb-1">Cluster Mínimo</p>
                <p className="text-xl font-bold text-red-600">{risk.critical_cluster_score?.toFixed(2) ?? '—'}</p>
              </div>
            </div>
          )}

          {score === null && (
            <div className="text-center py-6 text-slate-400">
              <p className="text-sm">Dimensão não ativa neste assessment.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Custom tick clicável ───────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.x
 * @param {any=} props.y
 * @param {any=} props.payload
 * @param {any=} props.radarPoints
 * @param {any=} props.onClick
 */
function ClickableTick({ x, y, payload, radarPoints, onClick }) {
  if (!payload) return null;
  const label = payload.value || '';
  // Encontrar a dimensão pelo label
  const dimKey = Object.entries(DIM_LABELS).find(([, v]) => label.startsWith(v) || v.startsWith(label.split(' ')[0]))?.[0];
  const point  = radarPoints?.find(p => p.dimension === dimKey);
  const level  = point?.level;
  const color  = LEVEL_COLORS[level] || '#475569';
  const isNA   = label.includes('(N/A)');

  return (
    <g>
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={500}
        fill={isNA ? '#94a3b8' : color}
        style={{ cursor: dimKey ? 'pointer' : 'default' }}
        onClick={() => dimKey && onClick(dimKey)}
      >
        {label}
      </text>
    </g>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.radarPoints
 * @param {any=} props.dimensionRiskSummary
 * @param {any=} props.onDimensionClick
 * @param {boolean=} props.showInstructions
 */
export default function FalRadarChart({ radarPoints, dimensionRiskSummary, onDimensionClick, showInstructions = true }) {
  const [selectedDim, setSelectedDim] = useState(null);

  if (!radarPoints?.length) return null;

  const hasShadow = !!dimensionRiskSummary && Object.keys(dimensionRiskSummary).length > 0;

  const sorted = [...radarPoints].sort((a, b) => {
    const ai = OFFICIAL_ORDER.indexOf(a.dimension);
    const bi = OFFICIAL_ORDER.indexOf(b.dimension);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const data = sorted.map(p => {
    const dimScore  = p.active === false ? 0 : (p.score || 0);
    const riskEntry = hasShadow ? dimensionRiskSummary[p.dimension] : null;
    const riskScore = riskEntry?.critical_cluster_score ?? dimScore;

    return {
      axis:      p.active === false
        ? `${DIM_LABELS[p.dimension] || p.axis} (N/A)`
        : (DIM_LABELS[p.dimension] || p.axis),
      dimension: p.dimension,
      score:     dimScore,
      risk:      p.active === false ? 0 : riskScore,
      fullMark:  3,
      inactive:  p.active === false,
    };
  });

  const handleDimClick = (dimKey) => {
    setSelectedDim(dimKey);
    onDimensionClick?.(dimKey);
  };

  /**
   * @param {Object} props
   * @param {any=} props.active
   * @param {any=} props.payload
   * @param {any=} props.label
   */
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const entry    = data.find(d => d.axis === label);
    const riskEntry = hasShadow && entry ? dimensionRiskSummary[entry.dimension] : null;
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-md p-3 text-xs space-y-1">
        <p className="font-semibold text-slate-800">{label}</p>
        {payload.map(p => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name === 'Score FAL' ? 'Score médio' : 'Cluster crítico'}: {Number(p.value).toFixed(2)}
          </p>
        ))}
        {riskEntry?.critical_cluster_key && (
          <p className="text-slate-500 pt-1 border-t border-slate-100">
            Risco: <span className="font-medium text-slate-700">{riskEntry.critical_cluster_key}</span>
          </p>
        )}
        <p className="text-slate-400 pt-1 border-t border-slate-100 italic">clique para ver detalhe</p>
      </div>
    );
  };

  // Tick customizado com cor por maturidade e clique
  const renderTick = (props) => (
    <ClickableTick {...props} radarPoints={radarPoints} onClick={handleDimClick} />
  );

  return (
    <>
      <ResponsiveContainer width="100%" height={460}>
        <RadarChart data={data} outerRadius="78%" margin={{ top: 16, right: 30, bottom: 16, left: 30 }}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis
            dataKey="axis"
            tick={renderTick}
          />
          <PolarRadiusAxis angle={90} domain={[0, 3]} tick={false} axisLine={false} />

          {/* Segunda camada — cluster crítico (sombra de risco) */}
          {hasShadow && (
            <Radar
              name="Cluster crítico"
              dataKey="risk"
              stroke="#f97316"
              fill="#f97316"
              fillOpacity={0.12}
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          )}

          {/* Camada principal — score médio da dimensão */}
          <Radar
            name="Score FAL"
            dataKey="score"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.25}
            strokeWidth={2}
          />

          <Tooltip content={<CustomTooltip />} />
          {hasShadow && (
            <Legend
              iconType="line"
              iconSize={16}
              formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
            />
          )}
        </RadarChart>
      </ResponsiveContainer>

      <p className="text-[10px] text-center text-slate-400 mt-1">
        Clique em um eixo para ver detalhe da dimensão
      </p>

      {/* Interpretação do gráfico */}
      {showInstructions && <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 leading-relaxed space-y-1.5">
        <p className="font-semibold text-slate-700 text-[11px] uppercase tracking-wide mb-2">Como interpretar este gráfico</p>
        <p>• Cada eixo representa uma das <strong>8 dimensões de maturidade</strong> avaliadas. A escala vai de <strong>0 a 3</strong> — quanto mais próximo da borda, maior a maturidade.</p>
        <p>• A <strong>área azul</strong> é o score médio da dimensão. Quanto mais preenchida, melhor o desempenho geral.</p>
        {false /* placeholder for conditional */ || <p>• A <strong>linha laranja tracejada</strong> (quando presente) indica o cluster mais crítico dentro de cada dimensão — revela onde o pior ponto de risco está escondido por trás de uma média aparentemente boa.</p>}
        <p>• Dimensões com scores baixos e muito diferentes das vizinhas indicam <strong>ruptura sistêmica</strong> — áreas que limitam toda a organização.</p>
      </div>}

      {/* Painel lateral de detalhe ao clicar numa dimensão */}
      {selectedDim && (
        <DimensionDetailPanel
          dimKey={selectedDim}
          radarPoints={radarPoints}
          dimensionRiskSummary={dimensionRiskSummary}
          onClose={() => setSelectedDim(null)}
        />
      )}
    </>
  );
}