/**
 * ReportMaturityOverview — Cobertura + Radar IFME™
 * Radar corrigido: labels não truncados, outerRadius reduzido, margens amplas
 */
import React from 'react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { DIMENSION_RADAR_LABELS, MATURITY_LEVELS, LABELS } from '@/services/report/falDictionary';

/**
 * @param {Object} props
 * @param {any=} props.level
 */
function LevelBadge({ level }) {
  const cfg = MATURITY_LEVELS[level] || { text: '#475569', bg: '#f1f5f9' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: cfg.bg, color: cfg.text,
      padding: '3px 10px', borderRadius: 9999,
      fontSize: 11, fontWeight: 700,
    }}>
      {level || '—'}
    </span>
  );
}

// Tick customizado para o radar — garante labels completos
/**
 * @param {Object} props
 * @param {any=} props.x
 * @param {any=} props.y
 * @param {any=} props.payload
 * @param {any=} props.cx
 * @param {any=} props.cy
 */
function CustomRadarTick({ x, y, payload, cx, cy }) {
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return null;
  const nx = dx / dist;
  const ny = dy / dist;
  const offset = 16;
  const tx = x + nx * offset;
  const ty = y + ny * offset;
  const anchor = Math.abs(nx) < 0.1 ? 'middle' : nx > 0 ? 'start' : 'end';

  return (
    <text
      x={tx} y={ty}
      textAnchor={anchor}
      dominantBaseline="central"
      style={{ fontSize: 10, fill: '#475569', fontWeight: 600, fontFamily: 'system-ui, sans-serif' }}
    >
      {payload.value}
    </text>
  );
}

const OFFICIAL_DIM_ORDER = [
  'governanca', 'juridico', 'controles_internos', 'financeiro',
  'contabil', 'tributario', 'operacional', 'sistemas',
];

/**
 * @param {Object} props
 * @param {any=} props.payload
 */
export default function ReportMaturityOverview({ payload }) {
  const { maturity_profile = {}, executive_summary = {}, report_scope } = payload;
  const dimensions = maturity_profile.dimensions || [];
  const activeDims  = dimensions.filter((d) => d.active);

  // Ordenar dimensões na sequência oficial para manter consistência com tabela
  const sortedActiveDims = [...activeDims].sort((a, b) => {
    const aIdx = OFFICIAL_DIM_ORDER.indexOf(a.key);
    const bIdx = OFFICIAL_DIM_ORDER.indexOf(b.key);
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });

  const radarData = sortedActiveDims.map((d) => {
    // Garantir que score está em escala 0–3 (já deve estar pelo backend)
    const scoreValue = +(d.score || 0).toFixed(2);
    return {
      subject: DIMENSION_RADAR_LABELS[d.key] || d.name || d.key,
      score: Math.min(3, Math.max(0, scoreValue)), // Clamp 0-3
      fullMark: 3,
    };
  });

  const executiveReading = executive_summary?.narrative || '';

  return (
    <div style={{ padding: '56px 64px', pageBreakAfter: 'always', fontFamily: 'system-ui, sans-serif', background: '#fff', minHeight: '1054px', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 9, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700, marginBottom: 6 }}>
          Cobertura do diagnóstico
        </p>
        <h2 style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: -0.5 }}>
          Perfil organizacional — IFME™
        </h2>
        <div style={{ width: 40, height: 3, background: '#3b82f6', borderRadius: 2, marginTop: 10 }} />
      </div>

      {/* Score geral banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
        borderRadius: 10, padding: '18px 28px', marginBottom: 32,
        display: 'flex', alignItems: 'center', gap: 36, flexWrap: 'wrap',
      }}>
        <div>
          <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
            Maturidade geral
          </p>
          <p style={{ fontSize: 36, fontWeight: 900, color: '#fff', lineHeight: 1 }}>
            {Math.round(executive_summary.overall_maturity_index || 0)}%
          </p>
        </div>
        <div style={{ width: 1, height: 48, background: '#334155' }} />
        <div>
          <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>Nível</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>
            {executive_summary.overall_maturity_level || '—'}
          </p>
        </div>
        <div style={{ width: 1, height: 48, background: '#334155' }} />
        <div>
          <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>Score</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>
            {executive_summary.overall_maturity_score?.toFixed
              ? executive_summary.overall_maturity_score.toFixed(2)
              : '—'}/3,00
          </p>
        </div>
        {report_scope?.applicable_dimensions_count != null && (
          <>
            <div style={{ width: 1, height: 48, background: '#334155' }} />
            <div>
              <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>Dimensões</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>
                {report_scope.applicable_dimensions_count}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Radar + Tabela */}
      <div style={{ display: 'flex', gap: 32 }}>

        {/* Radar — 65% do espaço, com margens generosas para não cortar labels */}
        <div style={{ flex: '0 0 55%', minWidth: 0 }}>
          <p style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            {LABELS.radar_title}
          </p>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart
                data={radarData}
                outerRadius={90}
                margin={{ top: 30, right: 50, bottom: 30, left: 50 }}
              >
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={<CustomRadarTick />}
                  tickLine={false}
                />
                <PolarRadiusAxis angle={90} domain={[0, 3]} tick={false} axisLine={false} />
                <Radar
                  dataKey="score"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.15}
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 3 }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tabela de dimensões */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            {LABELS.dim_summary}
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#1e293b' }}>
                {['Dimensão', 'Score', 'Classificação'].map((h) => (
                  <th key={h} style={{ fontSize: 9, color: '#ffffff', textTransform: 'uppercase', letterSpacing: 1, padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedActiveDims.map((dim, i) => (
                <tr key={dim.key} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ fontSize: 12, color: '#334155', fontWeight: 600, padding: '9px 8px' }}>{dim.name}</td>
                  <td style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', padding: '9px 8px' }}>
                    {dim.score?.toFixed ? dim.score.toFixed(2) : '—'}
                  </td>
                  <td style={{ padding: '9px 8px' }}><LevelBadge level={dim.level} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leitura executiva */}
      {executiveReading && (
        <div style={{ marginTop: 28, padding: '20px 24px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10 }}>
          <p style={{ fontSize: 9, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
            {LABELS.executive_reading}
          </p>
          {executiveReading.split('\n\n').filter(Boolean).map((para, i) => (
            <p key={i} style={{ fontSize: 12, color: '#334155', lineHeight: 1.8, margin: i > 0 ? '10px 0 0' : 0 }}>
              {para}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}