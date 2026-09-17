/**
 * ReportMaturityDetail — Análise detalhada das dimensões
 * Título adaptativo: "8 dimensões" ou "dimensões aplicáveis" conforme contexto
 */
import React from 'react';
import { SECTION_TITLES, MATURITY_LEVELS } from '@/services/report/falDictionary';

const LEVEL_READING = {
  Crítico:     'Fragilidades severas que comprometem a operação. Intervenção imediata necessária.',
  Básico:      'Estrutura presente, mas incompleta. Há gestão, porém com baixa consistência e integração.',
  Estruturado: 'Processos formalizados e funcionais. Pode evoluir com refinamento e automação.',
  Avançado:    'Alto grau de maturidade. Referência interna de boas práticas.',
};

/**
 * @param {Object} props
 * @param {any=} props.score
 */
function ScoreBar({ score }) {
  const pct   = Math.round((score / 3) * 100);
  const level = score < 1 ? 'Crítico' : score < 1.75 ? 'Básico' : score < 2.5 ? 'Estruturado' : 'Avançado';
  const color = MATURITY_LEVELS[level]?.color || '#94a3b8';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 800, color, width: 32, textAlign: 'right' }}>
        {score?.toFixed ? score.toFixed(2) : '—'}
      </span>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.payload
 */
export default function ReportMaturityDetail({ payload }) {
  const { maturity_profile = {}, report_scope } = payload;
  const dimensions = maturity_profile.dimensions || [];
  const activeDims  = dimensions.filter((d) => d.active).sort((a, b) => (b.score || 0) - (a.score || 0));

  // Título adaptativo baseado em scopo
   const applicableCount = report_scope?.applicable_dimensions_count ?? activeDims.length;
   const isAll8   = applicableCount >= 8;
   const sectionTitle = SECTION_TITLES.dimension_profile(applicableCount, isAll8);

   console.log('[ReportMaturityDetail]', { activeDims: activeDims.length, applicableCount, isAll8, sectionTitle });

  return (
    <div style={{ padding: '56px 64px', pageBreakAfter: 'always', fontFamily: 'system-ui, sans-serif', background: '#fff', minHeight: '1054px', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 9, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700, marginBottom: 6 }}>
          Perfil por dimensão
        </p>
        <h2 style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: -0.5 }}>
          {sectionTitle}
        </h2>
        <div style={{ width: 40, height: 3, background: '#3b82f6', borderRadius: 2, marginTop: 10 }} />
      </div>

      {/* Intro */}
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 28, lineHeight: 1.7 }}>
        Cada dimensão foi avaliada na escala de 0 a 3, representando respectivamente ausência total e excelência operacional.
        A leitura abaixo traduz o que o score significa na prática para esta organização.
      </p>

      {/* Tabela */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#1e293b' }}>
            {['Dimensão', 'Score / Barra', 'Classificação', 'Leitura'].map((h) => (
              <th key={h} style={{
                fontSize: 9, color: '#ffffff', textTransform: 'uppercase',
                letterSpacing: 1, padding: '8px 10px', textAlign: 'left', fontWeight: 700,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activeDims.map((dim, i) => {
            const level = dim.level || (
              (dim.score || 0) < 1    ? 'Crítico' :
              (dim.score || 0) < 1.75 ? 'Básico' :
              (dim.score || 0) < 2.5  ? 'Estruturado' : 'Avançado'
            );
            const cfg     = MATURITY_LEVELS[level] || { color: '#94a3b8', bg: '#f8fafc', text: '#64748b' };
            const reading = LEVEL_READING[level];

            return (
              <tr key={dim.key} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '14px 10px', minWidth: 110 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0 }}>{dim.name}</p>
                </td>
                <td style={{ padding: '14px 10px', minWidth: 160 }}>
                  <ScoreBar score={dim.score} />
                </td>
                <td style={{ padding: '14px 10px', minWidth: 110 }}>
                  <span style={{
                    display: 'inline-block',
                    fontSize: 11, fontWeight: 700,
                    background: cfg.bg, color: cfg.text,
                    padding: '4px 10px', borderRadius: 9999,
                  }}>
                    {level}
                  </span>
                </td>
                <td style={{ padding: '14px 10px' }}>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.5 }}>{reading}</p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Rodapé da tabela */}
      <div style={{ marginTop: 28, padding: '14px 18px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
          Escala: <strong style={{ color: '#475569' }}>0 = Inexistente</strong> · <strong style={{ color: '#475569' }}>1 = Básico</strong> · <strong style={{ color: '#475569' }}>2 = Estruturado</strong> · <strong style={{ color: '#475569' }}>3 = Avançado</strong>
        </p>
      </div>
    </div>
  );
}