/**
 * ReportMfisMatrix — Página 6
 * MFIS: heatmap da matriz sistêmica + legenda + texto breve
 */
import React from 'react';

const DIM_ABBR = {
  governanca: 'GOV', financeiro: 'FIN', operacional: 'OPE', sistemas: 'SIS',
  contabil: 'CTB', controles_internos: 'CON', juridico: 'JUR', tributario: 'TRI',
  // aliases legados
  operacoes: 'OPE', contabilidade: 'CTB', pessoas: 'PES',
};

function getHeatColor(score) {
  if (score === null || score === undefined) return { bg: '#f8fafc', text: '#cbd5e1' };
  // cross_score_final é 0–100
  if (score < 20)  return { bg: '#fef2f2', text: '#b91c1c' };
  if (score < 40)  return { bg: '#fffbeb', text: '#92400e' };
  if (score < 60)  return { bg: '#fef9c3', text: '#854d0e' };
  if (score < 80)  return { bg: '#eff6ff', text: '#1d4ed8' };
  return                  { bg: '#f0fdf4', text: '#15803d' };
}

/**
 * @param {Object} props
 * @param {any=} props.payload
 */
export default function ReportMfisMatrix({ payload }) {
  const { mfis_analysis = {}, maturity_profile = {} } = payload;
  const dimensions = (maturity_profile.dimensions || []).filter((d) => d.active);

  // Build score lookup — suporta ambos os formatos de campo (dim_a ou dimension_a_key)
  const scoreMap = {};
  (mfis_analysis.all_crossings || []).forEach((c) => {
    const dA = c.dimension_a_key || c.dim_a;
    const dB = c.dimension_b_key || c.dim_b;
    if (dA && dB) {
      const v = c.cross_score_final;
      scoreMap[`${dA}|${dB}`] = v;
      scoreMap[`${dB}|${dA}`] = v;
    }
  });

  const dimKeys = dimensions.map((d) => d.key);

  const legend = [
    { label: 'Ruptura (< 20)',       bg: '#fef2f2', text: '#b91c1c' },
    { label: 'Alto risco (20–40)',   bg: '#fffbeb', text: '#92400e' },
    { label: 'Atenção (40–60)',      bg: '#fef9c3', text: '#854d0e' },
    { label: 'Funcional (60–80)',    bg: '#eff6ff', text: '#1d4ed8' },
    { label: 'Maduro (≥ 80)',        bg: '#f0fdf4', text: '#15803d' },
  ];

  return (
    <div style={{ padding: '56px 64px', pageBreakAfter: 'always', fontFamily: 'system-ui, sans-serif', background: '#fff', minHeight: '1054px', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <p style={{ fontSize: 9, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700, marginBottom: 6 }}>
          MFIS™ — Visão Sistêmica
        </p>
        <h2 style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: -0.5 }}>
          Matriz FAL de Interdependência Sistêmica
        </h2>
        <div style={{ width: 40, height: 3, background: '#6366f1', borderRadius: 2, marginTop: 10 }} />
      </div>

      {/* Intro */}
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 28, lineHeight: 1.7 }}>
        A MFIS™ mapeia a qualidade de integração entre cada par de dimensões organizacionais.
        Quanto menor o score, mais crítica a ruptura sistêmica naquele cruzamento.
      </p>

      {/* Heatmap */}
      <div style={{ overflowX: 'auto', marginBottom: 28 }}>
        <table style={{ borderCollapse: 'collapse', margin: '0 auto' }}>
          <thead>
            <tr>
              <th style={{ width: 80, padding: 6 }}></th>
              {dimKeys.map((dk) => {
                const dim = dimensions.find((d) => d.key === dk);
                return (
                  <th key={dk} style={{
                    width: 56, padding: '4px 2px',
                    fontSize: 9, fontWeight: 700, color: '#64748b',
                    textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>
                    {DIM_ABBR[dk] || dk.slice(0, 3).toUpperCase()}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {dimKeys.map((rowKey) => {
              const rowDim = dimensions.find((d) => d.key === rowKey);
              return (
                <tr key={rowKey}>
                  <td style={{ fontSize: 10, fontWeight: 700, color: '#475569', padding: '2px 8px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {DIM_ABBR[rowKey] || rowKey.slice(0, 3).toUpperCase()}
                  </td>
                  {dimKeys.map((colKey) => {
                    if (rowKey === colKey) {
                      return (
                        <td key={colKey} style={{
                          width: 56, height: 48,
                          background: '#f1f5f9', border: '1px solid #e2e8f0',
                          textAlign: 'center', fontSize: 14, color: '#cbd5e1',
                        }}>·</td>
                      );
                    }
                    const score = scoreMap[`${rowKey}|${colKey}`];
                    const { bg, text } = getHeatColor(score ?? null);
                    return (
                      <td key={colKey} style={{
                        width: 56, height: 48,
                        background: bg, border: '1px solid #e2e8f0',
                        textAlign: 'center', fontSize: 12, fontWeight: 700, color: text,
                      }}>
                        {score !== undefined && score !== null ? Math.round(score) : '—'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
        {legend.map(({ label, bg, text }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 14, height: 14, background: bg, border: '1px solid #e2e8f0', borderRadius: 3, display: 'inline-block' }} />
            <span style={{ fontSize: 10, color: '#64748b' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Footer insight */}
      <div style={{ padding: '14px 18px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.7, margin: 0 }}>
          A matriz evidencia que as principais tensões se concentram na interface entre{' '}
          <strong>{mfis_analysis.top_tensions?.[0]?.crossing_label || 'as dimensões críticas'}</strong>{' '}
          {mfis_analysis.top_tensions?.[1] ? `e ${mfis_analysis.top_tensions[1].crossing_label}` : ''}.
          Essas rupturas limitam a integração operacional e a previsibilidade gerencial.
        </p>
      </div>
    </div>
  );
}