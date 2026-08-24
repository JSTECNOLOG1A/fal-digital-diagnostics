/**
 * ReportExecutiveSummary — Página 2
 * Narrativa executiva forte + dispersão/assimetria como bloco central (grupos)
 */
import React from 'react';

const LEVEL_COLOR = {
  Crítico:     '#ef4444',
  Básico:      '#f59e0b',
  Estruturado: '#3b82f6',
  Avançado:    '#22c55e',
};

const DISPERSION_RISK_COLOR = {
  crítico:  { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', badge: '#ef4444' },
  alto:     { bg: '#fff7ed', border: '#fed7aa', text: '#92400e', badge: '#f97316' },
  moderado: { bg: '#fefce8', border: '#fde68a', text: '#78350f', badge: '#eab308' },
  baixo:    { bg: '#f0fdf4', border: '#bbf7d0', text: '#14532d', badge: '#22c55e' },
};

/**
 * @param {Object} props
 * @param {any=} props.label
 * @param {any=} props.value
 * @param {any=} props.sub
 * @param {any=} props.accent
 */
function KpiCard({ label, value, sub, accent }) {
  return (
    <div style={{
      flex: 1, minWidth: 110,
      padding: '18px 16px',
      border: '1px solid #e2e8f0',
      borderTop: `3px solid ${accent || '#3b82f6'}`,
      borderRadius: 8,
      background: '#fff',
    }}>
      <p style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{value || '—'}</p>
      {sub && <p style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.company
 * @param {any=} props.maxScore
 */
function CompanyBar({ company, maxScore = 3 }) {
  const pct = Math.round(((company.score || 0) / maxScore) * 100);
  const color = LEVEL_COLOR[company.level] || '#94a3b8';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      <span style={{ fontSize: 10, color: '#475569', width: 140, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {company.name}
      </span>
      <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color, width: 36, textAlign: 'right', flexShrink: 0 }}>
        {company.score?.toFixed(1)}
      </span>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {any=} props.payload
 */
export default function ReportExecutiveSummary({ payload }) {
  const { executive_summary = {}, headline = {}, dispersion, dimensions = [] } = payload;
  const {
    overall_maturity_level,
    overall_maturity_score,
    overall_maturity_index,
    main_systemic_tension,
    systemic_leverage_dimension,
    top_risks = [],
    narrative,
  } = executive_summary;

  const isGroup = payload?.meta?.reportScope === 'group';
  const score = headline?.overallScore ?? overall_maturity_score;
  const level = headline?.overallLevel ?? overall_maturity_level;
  const deltaScore = headline?.deltaScore;
  const levelColor = LEVEL_COLOR[level] || '#64748b';

  const dispRisk = dispersion?.dispersion_risk;
  const dispColors = DISPERSION_RISK_COLOR[dispRisk] || DISPERSION_RISK_COLOR.moderado;

  // Conclusões-chave: usa top_risks ou fallback
  const conclusions = isGroup && dispersion
    ? [
        `Dispersão interna ${dispRisk}: gap de ${dispersion.gap?.toFixed(2)} pts entre melhor e pior empresa`,
        top_risks[0] || `Melhor empresa: ${dispersion.best_company?.name} (${dispersion.best_company?.score?.toFixed(2)})`,
        top_risks[1] || `Principal foco: ${dispersion.worst_company?.name} (${dispersion.worst_company?.score?.toFixed(2)})`,
      ]
    : [
        top_risks[0] || 'Avaliar fragilidades de integração entre dimensões',
        top_risks[1] || 'Priorizar governança e disciplina financeira',
        top_risks[2] || 'Recomenda-se plano de ação em horizonte de 90 dias',
      ];

  return (
    <div style={{ padding: '56px 64px', pageBreakAfter: 'always', fontFamily: 'system-ui, sans-serif', background: '#fff', minHeight: '1054px', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 9, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700, marginBottom: 6 }}>
          Sumário Executivo
        </p>
        <h2 style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: -0.5 }}>
          Visão Geral do Diagnóstico
        </h2>
        <div style={{ width: 40, height: 3, background: '#3b82f6', borderRadius: 2, marginTop: 10 }} />
      </div>

      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
        <KpiCard
          label="Maturidade geral"
          value={level || '—'}
          sub={score != null ? `${score.toFixed(2)}/3,00` : undefined}
          accent={levelColor}
        />
        {deltaScore != null && (
          <KpiCard
            label="Evolução"
            value={deltaScore > 0 ? `+${deltaScore.toFixed(2)}` : deltaScore.toFixed(2)}
            sub="vs. ciclo anterior"
            accent={deltaScore >= 0 ? '#22c55e' : '#ef4444'}
          />
        )}
        {isGroup && dispersion ? (
          <>
            <KpiCard
              label="Dispersão interna"
              value={`Gap: ${dispersion.gap?.toFixed(2)} pts`}
              sub={`Risco: ${dispRisk}`}
              accent={dispColors.badge}
            />
            <KpiCard
              label="Empresas avaliadas"
              value={`${dispersion.assessed_count}/${dispersion.total_count}`}
              sub="cobertura do ciclo"
              accent="#3b82f6"
            />
          </>
        ) : (
          <>
            <KpiCard
              label="Principal tensão"
              value={main_systemic_tension || '—'}
              accent="#ef4444"
            />
            <KpiCard
              label="Ponto de alavanca"
              value={systemic_leverage_dimension || '—'}
              accent="#3b82f6"
            />
          </>
        )}
      </div>

      {/* Narrativa executiva */}
      {narrative && (
        <div style={{
          background: '#f8fafc', border: '1px solid #e2e8f0',
          borderRadius: 10, padding: '22px 26px', marginBottom: 24,
        }}>
          <p style={{ fontSize: 9, color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
            Síntese Executiva
          </p>
          {narrative.split('\n\n').filter(Boolean).map((para, i) => (
            <p key={i} style={{ fontSize: 13, color: '#334155', lineHeight: 1.8, marginBottom: i < narrative.split('\n\n').length - 1 ? 10 : 0 }}>
              {para}
            </p>
          ))}
        </div>
      )}

      {/* BLOCO DE DISPERSÃO — protagonista para relatório de grupo */}
      {isGroup && dispersion && dispersion.assessed_count >= 2 && (
        <div style={{
          background: dispColors.bg,
          border: `1px solid ${dispColors.border}`,
          borderRadius: 10, padding: '20px 24px', marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <p style={{ fontSize: 9, color: dispColors.badge, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
                Assimetria entre Empresas
              </p>
              <p style={{ fontSize: 13, fontWeight: 700, color: dispColors.text }}>
                Risco de dispersão interna:{' '}
                <span style={{ textTransform: 'capitalize' }}>{dispRisk}</span>
                {' '}— Gap de {dispersion.gap?.toFixed(2)} pontos
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Melhor → Pior</p>
              <p style={{ fontSize: 14, fontWeight: 800, color: dispColors.text }}>
                {dispersion.best_company?.score?.toFixed(2)} → {dispersion.worst_company?.score?.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Barras horizontais por empresa */}
          <div style={{ marginTop: 8 }}>
            {dispersion.companies?.slice(0, 8).map(company => (
              <CompanyBar key={company.id} company={company} maxScore={3} />
            ))}
            {dispersion.companies?.length > 8 && (
              <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 6, textAlign: 'center' }}>
                + {dispersion.companies.length - 8} empresa(s) não exibidas
              </p>
            )}
          </div>
        </div>
      )}

      {/* Conclusões-chave */}
      <div>
        <p style={{ fontSize: 9, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
          Conclusões-chave
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {conclusions.map((c, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '11px 14px',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
            }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%',
                background: '#eff6ff', color: '#3b82f6',
                fontSize: 10, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: 1,
              }}>{i + 1}</span>
              <span style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>{c}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}