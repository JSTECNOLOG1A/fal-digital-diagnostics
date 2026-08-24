/**
 * ReportMaturityProfile — Perfil de Maturidade por Dimensão
 * Consome: payload.maturity_profile
 */
import React from 'react';

const LEVEL_CONFIG = {
  Crítico:     { color: '#ef4444', bg: '#fef2f2', text: '#b91c1c', bar: '#ef4444' },
  Básico:      { color: '#f59e0b', bg: '#fffbeb', text: '#92400e', bar: '#f59e0b' },
  Estruturado: { color: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8', bar: '#3b82f6' },
  Avançado:    { color: '#22c55e', bg: '#f0fdf4', text: '#15803d', bar: '#22c55e' },
};

/**
 * @param {Object} props
 * @param {any=} props.dim
 */
function DimensionRow({ dim }) {
  const cfg = LEVEL_CONFIG[dim.level] || LEVEL_CONFIG.Básico;
  const pct = Math.round((dim.score / 3) * 100);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '12px 0', borderBottom: '1px solid #f1f5f9',
    }}>
      <div style={{ width: 120, flexShrink: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{dim.name}</p>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: cfg.bar, borderRadius: 4,
            transition: 'width 0.3s',
          }} />
        </div>
      </div>
      <div style={{ width: 48, textAlign: 'right', flexShrink: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: cfg.color }}>{dim.score?.toFixed ? dim.score.toFixed(2) : dim.score}</p>
      </div>
      <div style={{ width: 96, flexShrink: 0 }}>
        <span style={{
          display: 'inline-block', padding: '3px 10px',
          background: cfg.bg, color: cfg.text,
          borderRadius: 9999, fontSize: 11, fontWeight: 700,
        }}>
          {dim.level}
        </span>
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.payload
 */
export default function ReportMaturityProfile({ payload }) {
  const { maturity_profile, executive_summary } = payload;
  const { dimensions, level_distribution } = maturity_profile;
  const activeDims = dimensions.filter((d) => d.active);

  const distributionBars = [
    { label: 'Crítico',     count: level_distribution.critical,     cfg: LEVEL_CONFIG.Crítico },
    { label: 'Básico',      count: level_distribution.basic,        cfg: LEVEL_CONFIG.Básico },
    { label: 'Estruturado', count: level_distribution.structured,   cfg: LEVEL_CONFIG.Estruturado },
    { label: 'Avançado',    count: level_distribution.advanced,     cfg: LEVEL_CONFIG.Avançado },
  ];

  return (
    <div style={{ padding: '48px 56px', pageBreakAfter: 'always', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 10, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700, marginBottom: 6 }}>
          02 · Perfil de Maturidade
        </p>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: 0 }}>
          IFME™ — Índice FAL de Maturidade Empresarial
        </h2>
        <div style={{ width: 40, height: 3, background: '#3b82f6', borderRadius: 2, marginTop: 10 }} />
      </div>

      {/* Score geral */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a, #1e3a5f)',
        borderRadius: 14, padding: '24px 28px', marginBottom: 28,
        display: 'flex', alignItems: 'center', gap: 28,
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 48, fontWeight: 900, color: '#fff', lineHeight: 1 }}>
            {Math.round(executive_summary.overall_maturity_index)}%
          </p>
          <p style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 2 }}>
            maturidade geral
          </p>
        </div>
        <div style={{ width: 1, height: 60, background: '#334155' }} />
        <div>
          <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>Nível geral</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>
            {executive_summary.overall_maturity_level}
          </p>
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Score: {executive_summary.overall_maturity_score?.toFixed ? executive_summary.overall_maturity_score.toFixed(2) : '—'}/3.00
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
          {distributionBars.map(({ label, count, cfg }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: cfg.color }}>{count}</p>
              <p style={{ fontSize: 10, color: '#64748b' }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Table header */}
      <div style={{ display: 'flex', gap: 16, padding: '8px 0', borderBottom: '2px solid #e2e8f0', marginBottom: 4 }}>
        <p style={{ width: 120, fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Dimensão</p>
        <p style={{ flex: 1, fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Score</p>
        <p style={{ width: 48, fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'right' }}>Valor</p>
        <p style={{ width: 96, fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Nível</p>
      </div>

      {/* Dimension rows */}
      {activeDims
        .sort((a, b) => (a.score || 0) - (b.score || 0))
        .map((dim) => (
          <DimensionRow key={dim.key} dim={dim} />
        ))}

      {/* Legend */}
      <div style={{ marginTop: 24, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {Object.entries(LEVEL_CONFIG).map(([label, cfg]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
            <span style={{ fontSize: 11, color: '#64748b' }}>{label}</span>
          </div>
        ))}
        <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>Escala: 0 a 3.00</span>
      </div>
    </div>
  );
}