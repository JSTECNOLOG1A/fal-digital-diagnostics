/**
 * ReportSectionLibrary — Biblioteca modular de seções reutilizáveis
 * Cada seção é um componente independente que pode ser composto em qualquer ordem
 */
import React from 'react';
import ReportExecutiveSummaryComponent from './ReportExecutiveSummary';

// ─── Capa ─────────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.payload
 */
export function CoverSection({ payload }) {
  const { context, meta, headline } = payload;
  const { group, company, unit, cycle } = context;
  const entity = group || company || unit;

  const cycleTypeLabel = {
    initial: 'Diagnóstico Inicial',
    review_90: 'Revisão 90 Dias',
    review_180: 'Revisão 180 Dias',
    review_365: 'Revisão Anual',
    followup: 'Acompanhamento',
    custom: 'Avaliação Customizada',
  }[cycle.cycle_type] || 'Diagnóstico';

  return (
    <div style={{ padding: '56px 64px', fontFamily: 'system-ui', background: '#fff', minHeight: '1054px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 48, fontWeight: 900, color: '#0f172a', margin: 0, lineHeight: 1.1, letterSpacing: -1 }}>
          {headline.title}
        </h1>
        <p style={{ fontSize: 18, color: '#64748b', marginTop: 12, fontWeight: 500 }}>
          {entity?.name}
        </p>
      </div>

      {/* Metadata */}
      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 32 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          <div>
            <p style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700, margin: '0 0 4px' }}>Ciclo</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>{cycle.name}</p>
            {cycle.reference_date && <p style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Data-base: {cycle.reference_date}</p>}
          </div>
          <div>
            <p style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700, margin: '0 0 4px' }}>Tipo</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>{cycleTypeLabel}</p>
          </div>
        </div>
        <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>
          © FAL™ — Índice de Maturidade Empresarial | {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

// ─── Sumário Executivo ────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.payload
 */
export function ExecutiveSummarySection({ payload }) {
  return <ReportExecutiveSummaryComponent payload={payload} />;
}

// ─── Cobertura da Rodada ───────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.payload
 */
export function CoverageSection({ payload }) {
  const { context, isPartialCoverage } = payload;
  const { coverage } = context;

  if (!coverage) return null;

  const ratio = coverage.coverage_ratio || 0;
  const percentage = Math.round(ratio * 100);

  return (
    <div style={{ padding: '56px 64px', fontFamily: 'system-ui', background: '#fff', minHeight: '1054px', boxSizing: 'border-box' }}>
      <h2 style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: -0.5 }}>Cobertura da Rodada</h2>
      <div style={{ width: 40, height: 3, background: '#3b82f6', borderRadius: 2, marginTop: 10, marginBottom: 32 }} />

      {isPartialCoverage && (
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: 16, marginBottom: 24 }}>
          <p style={{ fontSize: 12, color: '#92400e', margin: 0, fontWeight: 600 }}>
            ⚠️ Cobertura parcial ({percentage}%) — Relatório gerado com {coverage.assessed_companies} de {coverage.total_companies} empresas.
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20, textAlign: 'center' }}>
          <p style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, margin: '0 0 8px' }}>Empresas Avaliadas</p>
          <p style={{ fontSize: 40, fontWeight: 900, color: '#0f172a', margin: 0 }}>{coverage.assessed_companies}</p>
          <p style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>de {coverage.total_companies} total</p>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20, textAlign: 'center' }}>
          <p style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, margin: '0 0 8px' }}>Taxa de Cobertura</p>
          <p style={{ fontSize: 40, fontWeight: 900, color: '#0f172a', margin: 0 }}>{percentage}%</p>
          <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, marginTop: 12, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${percentage}%`, background: percentage >= 80 ? '#10b981' : '#f59e0b' }} />
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
        O ciclo {context.cycle.name} avaliou {coverage.assessed_companies} de {coverage.total_companies} empresas do grupo.
        {isPartialCoverage && ' Por ser parcial, algumas análises consolidadas podem não refletir a realidade completa do grupo.'}
      </p>
    </div>
  );
}

// ─── Perfil por Dimensão ───────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.payload
 */
export function DimensionProfileSection({ payload }) {
  const { dimensions } = payload;

  if (!dimensions || dimensions.length === 0) return null;

  return (
    <div style={{ padding: '56px 64px', fontFamily: 'system-ui', background: '#fff', minHeight: '1054px', boxSizing: 'border-box' }}>
      <h2 style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: -0.5 }}>Perfil por Dimensão</h2>
      <div style={{ width: 40, height: 3, background: '#3b82f6', borderRadius: 2, marginTop: 10, marginBottom: 32 }} />

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #0f172a' }}>
            <th style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Dimensão</th>
            <th style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>Score</th>
            <th style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>Nível</th>
            <th style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>Tendência</th>
          </tr>
        </thead>
        <tbody>
          {dimensions.map((dim, idx) => (
            <tr key={dim.key} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
              <td style={{ padding: '12px 10px', fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{dim.name}</td>
              <td style={{ padding: '12px 10px', fontSize: 14, fontWeight: 900, color: '#0f172a', textAlign: 'center' }}>{dim.score?.toFixed(1) || '—'}</td>
              <td style={{ padding: '12px 10px', fontSize: 11, fontWeight: 700, color: '#0f172a', textAlign: 'center' }}>
                {dim.level ? <span style={{ background: '#eff6ff', color: '#0284c7', padding: '2px 8px', borderRadius: 3 }}>{dim.level}</span> : '—'}
              </td>
              <td style={{ padding: '12px 10px', fontSize: 10, color: '#64748b', textAlign: 'right' }}>—</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Metodologia ───────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {any=} props.payload
 */
export function MethodologySection({ payload }) {
  return (
    <div style={{ padding: '56px 64px', fontFamily: 'system-ui', background: '#fff', minHeight: '1054px', boxSizing: 'border-box' }}>
      <h2 style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: -0.5 }}>Metodologia</h2>
      <div style={{ width: 40, height: 3, background: '#3b82f6', borderRadius: 2, marginTop: 10, marginBottom: 32 }} />

      <div style={{ fontSize: 12, lineHeight: 1.8, color: '#475569' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 20, marginBottom: 8 }}>FAL™ — Índice de Maturidade Empresarial</h3>
        <p>O FAL (Framework de Análise de Liderança) é um método diagnóstico consolidado que avalia a maturidade empresarial em 8 dimensões estratégicas, permitindo leitura integrada da governança, capacidade executiva e ambiente de controles de uma organização.</p>

        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 20, marginBottom: 8 }}>Escopo de Avaliação</h3>
        <p>O diagnóstico foi conduzido mediante entrevistas estruturadas, análise documental e observação operacional, com cobertura nas dimensões de Governança, Jurídico, Controles Internos, Financeiro, Contábil, Fiscal/Tributário, Operacional e Tecnologia.</p>

        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 20, marginBottom: 8 }}>Escala de Maturidade</h3>
        <p>Cada dimensão e cluster é avaliado em escala de 0 a 100, com classificação em 4 níveis: Crítico (0–40), Básico (40–70), Estruturado (70–85), Avançado (85–100).</p>
      </div>
    </div>
  );
}