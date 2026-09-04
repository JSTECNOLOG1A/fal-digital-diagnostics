/**
 * ReportMfisAnalysis — Análise MFIS™
 * Consome: payload.mfis_analysis + payload.maturity_profile
 */
import React from 'react';

const DIM_ABBR = {
  governanca: 'GV', financeiro: 'FI', operacoes: 'OP', sistemas: 'SI',
  contabilidade: 'CT', pessoas: 'PE', juridico: 'JU', tributario: 'TR',
};

function getScoreColor(score) {
  if (score < 1)    return { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' };
  if (score < 1.5)  return { bg: '#fffbeb', text: '#92400e', border: '#fcd34d' };
  if (score < 2)    return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' };
  return                   { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' };
}

/**
 * @param {Object} props
 * @param {any=} props.score
 */
function MfisHeatmapCell({ score }) {
  if (score === null || score === undefined) {
    return (
      <td style={{
        width: 48, height: 48,
        background: '#f8fafc', border: '1px solid #e2e8f0',
        textAlign: 'center', fontSize: 10, color: '#cbd5e1',
      }}>—</td>
    );
  }
  const { bg, text } = getScoreColor(score);
  return (
    <td style={{
      width: 48, height: 48,
      background: bg, border: '1px solid #e2e8f0',
      textAlign: 'center', fontSize: 12, fontWeight: 700, color: text,
    }}>
      {score.toFixed(1)}
    </td>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.payload
 */
export default function ReportMfisAnalysis({ payload }) {
  const { mfis_analysis, maturity_profile } = payload;
  const { top_tensions, systemic_leverage_dimension, dimension_impacts, narrative } = mfis_analysis;
  const { dimensions } = maturity_profile;
  const activeDims = dimensions.filter((d) => d.active);

  // Build mini heatmap matrix
  const dimKeys = activeDims.map((d) => d.key).slice(0, 6);
  const scoreMap = {};
  (mfis_analysis.all_crossings || []).forEach((c) => {
    if (c.dim_a && c.dim_b) {
      scoreMap[`${c.dim_a}|${c.dim_b}`] = c.cross_score_final;
      scoreMap[`${c.dim_b}|${c.dim_a}`] = c.cross_score_final;
    }
  });

  // Top leverage dims
  const topLeverage = [...(dimension_impacts || [])]
    .sort((a, b) => (b.leverage_score || 0) - (a.leverage_score || 0))
    .slice(0, 4);

  return (
    <div style={{ padding: '48px 56px', pageBreakAfter: 'always', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 10, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700, marginBottom: 6 }}>
          04 · Análise Sistêmica
        </p>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: 0 }}>
          MFIS™ — Matriz FAL de Interdependência Sistêmica
        </h2>
        <div style={{ width: 40, height: 3, background: '#6366f1', borderRadius: 2, marginTop: 10 }} />
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 28, alignItems: 'flex-start' }}>
        {/* Heatmap */}
        <div style={{ flex: 1.5 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            Mapa de Interdependências
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#1e293b' }}>
                  <th style={{ width: 80, fontSize: 9, color: '#ffffff', padding: 4 }}></th>
                  {dimKeys.map((dk) => (
                    <th key={dk} style={{
                      width: 48, fontSize: 9, fontWeight: 700, color: '#ffffff',
                      textAlign: 'center', padding: '4px 2px', textTransform: 'uppercase',
                    }}>
                      {DIM_ABBR[dk] || dk.slice(0, 2).toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dimKeys.map((rowKey, ri) => {
                  const rowDim = dimensions.find((d) => d.key === rowKey);
                  return (
                    <tr key={rowKey}>
                      <td style={{ fontSize: 10, color: '#475569', fontWeight: 600, padding: '2px 6px', whiteSpace: 'nowrap' }}>
                        {DIM_ABBR[rowKey] || rowKey.slice(0, 2).toUpperCase()} {rowDim?.name?.slice(0, 8) || ''}
                      </td>
                      {dimKeys.map((colKey, ci) => {
                        if (ri === ci) {
                          return (
                            <td key={colKey} style={{
                              width: 48, height: 48,
                              background: '#f1f5f9', border: '1px solid #e2e8f0',
                              textAlign: 'center', fontSize: 10, color: '#94a3b8',
                            }}>
                              ·
                            </td>
                          );
                        }
                        const score = scoreMap[`${rowKey}|${colKey}`];
                        return <MfisHeatmapCell key={colKey} score={score ?? null} />;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
            {[
              { label: 'Crítico (< 1.0)', color: '#fef2f2', text: '#b91c1c' },
              { label: 'Grave (1.0–1.5)', color: '#fffbeb', text: '#92400e' },
              { label: 'Moderado (1.5–2.0)', color: '#eff6ff', text: '#1d4ed8' },
              { label: 'Leve (≥ 2.0)', color: '#f0fdf4', text: '#15803d' },
            ].map(({ label, color, text }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 12, height: 12, background: color, border: '1px solid #e2e8f0', borderRadius: 2, display: 'inline-block' }} />
                <span style={{ fontSize: 9, color: '#64748b' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Leverage ranking */}
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            Dimensões por Alavancagem
          </p>
          {topLeverage.map((dim, i) => (
            <div key={dim.dimension_label || i} style={{
              padding: '12px 14px',
              background: dim.is_systemic_leverage_point ? '#eff6ff' : '#f8fafc',
              border: `1px solid ${dim.is_systemic_leverage_point ? '#bfdbfe' : '#e2e8f0'}`,
              borderRadius: 10, marginBottom: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{dim.dimension_label || '—'}</p>
                {dim.is_systemic_leverage_point && (
                  <span style={{ fontSize: 10, color: '#1d4ed8', fontWeight: 700, background: '#dbeafe', padding: '2px 8px', borderRadius: 9999 }}>
                    ⚡ Alavanca
                  </span>
                )}
              </div>
              <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, ((dim.leverage_score || 0) / 3) * 100)}%`,
                  background: dim.is_systemic_leverage_point ? '#3b82f6' : '#94a3b8',
                  borderRadius: 2,
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top tensions list */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
          Principais Tensões Identificadas
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {top_tensions.slice(0, 5).map((t, i) => {
            const { bg, text, border } = getScoreColor(t.cross_score_final);
            const normalizedScore = (t.cross_score_final / 100) * 3; // Converter 0-100 → 0-3 para exibição
            return (
              <div key={t.crossing_key} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', background: bg, border: `1px solid ${border}`, borderRadius: 8,
              }}>
                <span style={{ fontWeight: 800, color: text, fontSize: 12, width: 20 }}>#{i + 1}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{t.crossing_label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: text }}>
                  {normalizedScore?.toFixed ? normalizedScore.toFixed(2) : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Narrative */}
      {narrative && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px' }}>
          <p style={{ fontSize: 11, color: '#6366f1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
            Interpretação Consultiva
          </p>
          {narrative.split('\n\n').map((para, i) => (
            <p key={i} style={{ fontSize: 13, color: '#334155', lineHeight: 1.75, marginBottom: 10 }}>{para}</p>
          ))}
        </div>
      )}
    </div>
  );
}