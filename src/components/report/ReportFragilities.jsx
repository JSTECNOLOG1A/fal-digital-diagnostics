/**
 * ReportFragilities — Página 5
 * Principais fragilidades: top 5 cruzamentos + narrativa
 */
import React from 'react';

const IMPACT_LABELS = {
  GxF: 'Distorção de leitura gerencial e decisões sem base',
  GxC: 'Supervisão frágil e governança desconectada',
  FxC: 'Informação contábil não reflete realidade financeira',
  FxO: 'Desintegração entre planejamento e execução operacional',
  OxS: 'Baixa rastreabilidade e automação insuficiente',
  PxG: 'Falta de direcionamento estratégico para pessoas',
  default: 'Integração deficiente entre as áreas',
};

function getLevel(score) {
  if (score < 1)   return { label: 'Crítico',  color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' };
  if (score < 1.5) return { label: 'Alto risco', color: '#92400e', bg: '#fffbeb', border: '#fcd34d' };
  if (score < 2)   return { label: 'Atenção',  color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' };
  return                  { label: 'Leve',     color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' };
}

/**
 * @param {Object} props
 * @param {any=} props.payload
 */
export default function ReportFragilities({ payload }) {
  const { fragilities = {} } = payload;
  const { top_crossings = [], narrative } = fragilities;

  return (
    <div style={{ padding: '56px 64px', pageBreakAfter: 'always', fontFamily: 'system-ui, sans-serif', background: '#fff', minHeight: '1054px', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <p style={{ fontSize: 9, color: '#ef4444', textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700, marginBottom: 6 }}>
          Principais Fragilidades
        </p>
        <h2 style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: -0.5 }}>
          Fragilidades Estruturais Identificadas
        </h2>
        <div style={{ width: 40, height: 3, background: '#ef4444', borderRadius: 2, marginTop: 10 }} />
      </div>

      {/* Intro */}
      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '14px 18px', marginBottom: 32 }}>
        <p style={{ fontSize: 13, color: '#7f1d1d', lineHeight: 1.7, margin: 0 }}>
          As fragilidades abaixo representam os pontos de maior ruptura sistêmica identificados pelo MFIS™.
          São os cruzamentos entre dimensões onde a organização perde mais eficiência e previsibilidade.
        </p>
      </div>

      {/* Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 32 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #0f172a' }}>
            {['#', 'Cruzamento / Área', 'Score', 'Classificação', 'Impacto Predominante'].map((h) => (
              <th key={h} style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {top_crossings.slice(0, 5).map((c, i) => {
            const lvl = getLevel(c.cross_score_final ?? 0);
            const impact = IMPACT_LABELS[c.crossing_key] || IMPACT_LABELS.default;
            return (
              <tr key={c.crossing_key || i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '13px 10px' }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: lvl.bg, color: lvl.color,
                    fontSize: 11, fontWeight: 800,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>{i + 1}</span>
                </td>
                <td style={{ padding: '13px 10px' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0 }}>{c.crossing_label || c.crossing_key}</p>
                  <p style={{ fontSize: 10, color: '#94a3b8', margin: '2px 0 0', fontFamily: 'monospace' }}>{c.crossing_key}</p>
                </td>
                <td style={{ padding: '13px 10px' }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: lvl.color }}>
                    {c.cross_score_final?.toFixed ? c.cross_score_final.toFixed(2) : '—'}
                  </span>
                </td>
                <td style={{ padding: '13px 10px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, background: lvl.bg, color: lvl.color, padding: '3px 10px', borderRadius: 9999 }}>
                    {lvl.label}
                  </span>
                </td>
                <td style={{ padding: '13px 10px' }}>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.5 }}>{impact}</p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Narrative */}
      {narrative && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '20px 24px' }}>
          <p style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
            Análise Interpretativa
          </p>
          {narrative.split('\n\n').filter(Boolean).map((para, i) => (
            <p key={i} style={{ fontSize: 13, color: '#334155', lineHeight: 1.75, marginBottom: 8 }}>{para}</p>
          ))}
        </div>
      )}
    </div>
  );
}