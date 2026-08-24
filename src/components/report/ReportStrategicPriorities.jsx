/**
 * ReportStrategicPriorities — Página 8
 * Prioridades estratégicas: 3 cards verticais com ação, impacto e dimensões afetadas
 */
import React from 'react';

const CARD_STYLES = [
  { accent: '#ef4444', tagBg: '#fef2f2', tagText: '#b91c1c', numBg: '#fef2f2', numText: '#b91c1c', tag: 'P1 — Crítica', horizon: '0–90 dias' },
  { accent: '#f59e0b', tagBg: '#fffbeb', tagText: '#92400e', numBg: '#fffbeb', numText: '#92400e', tag: 'P2 — Alta', horizon: '30–120 dias' },
  { accent: '#3b82f6', tagBg: '#eff6ff', tagText: '#1d4ed8', numBg: '#eff6ff', numText: '#1d4ed8', tag: 'P3 — Relevante', horizon: '60–180 dias' },
];

function buildCards(payload) {
  const { mfis_analysis = {}, maturity_profile = {}, fragilities = {} } = payload;
  const { systemic_leverage_dimension, top_tensions = [] } = mfis_analysis;
  const { top_crossings = [] } = fragilities;
  const dimensions = maturity_profile.dimensions || [];
  const criticalDims = dimensions.filter((d) => d.level === 'Crítico' && d.active);

  return [
    {
      title: `Fortalecer: ${systemic_leverage_dimension || 'Dimensão de Alavanca'}`,
      description: `A dimensão de alavanca sistêmica identificada pelo MFIS™. Melhorias estruturadas aqui irradiam positivamente sobre toda a organização, com efeito multiplicador sobre governança, processos e controles.`,
      impact: 'Alto — efeito cascata sobre múltiplas dimensões',
      affected: [systemic_leverage_dimension, top_tensions[0]?.dim_a].filter(Boolean).join(', ') || '—',
      actions: [
        'Mapear gaps críticos na dimensão',
        'Estruturar grupo de trabalho dedicado',
        'Definir KPIs de evolução mensal',
      ],
    },
    {
      title: `Resolver tensão: ${top_tensions[0]?.crossing_label || 'Integração Sistêmica'}`,
      description: `A maior ruptura sistêmica identificada. Essas duas áreas operando em silos limitam exponencialmente a escalabilidade e a previsibilidade gerencial da organização.`,
      impact: 'Médio a alto — impacto direto em decisões executivas',
      affected: [top_tensions[0]?.dim_a, top_tensions[0]?.dim_b].filter(Boolean).join(' + ') || '—',
      actions: [
        'Realizar diagnóstico de causa-raiz',
        'Criar rituais de integração entre equipes',
        'Padronizar fluxos críticos de interface',
      ],
    },
    {
      title: `Consolidar: ${criticalDims[0]?.name || 'Controles Internos'}`,
      description: `Dimensão(ões) em nível crítico requerem fundações sólidas. Formalização, documentação e automação são pré-requisitos para qualquer outra transformação duradoura.`,
      impact: 'Médio — base para sustentabilidade da operação',
      affected: criticalDims.slice(0, 3).map((d) => d.name).join(', ') || '—',
      actions: [
        'Documentar processos críticos',
        'Implementar controles básicos',
        'Treinar equipes nas novas rotinas',
      ],
    },
  ];
}

/**
 * @param {Object} props
 * @param {any=} props.payload
 */
export default function ReportStrategicPriorities({ payload }) {
  // Garantir que strategic_priorities seja sempre array
  // Se não for array ou estiver vazio → usar buildCards como fallback
  const strategicPriorities = payload?.strategic_priorities;
  let cards = [];
  
  if (Array.isArray(strategicPriorities) && strategicPriorities.length > 0) {
    cards = strategicPriorities.slice(0, 3);
  } else {
    cards = buildCards(payload);
  }

  return (
    <div style={{ padding: '56px 64px', pageBreakAfter: 'always', fontFamily: 'system-ui, sans-serif', background: '#fff', minHeight: '1054px', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <p style={{ fontSize: 9, color: '#10b981', textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700, marginBottom: 6 }}>
          Prioridades Estratégicas
        </p>
        <h2 style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: -0.5 }}>
          Agenda de Transformação Organizacional
        </h2>
        <div style={{ width: 40, height: 3, background: '#10b981', borderRadius: 2, marginTop: 10 }} />
      </div>

      {/* Intro */}
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '14px 18px', marginBottom: 32 }}>
        <p style={{ fontSize: 13, color: '#14532d', lineHeight: 1.7, margin: 0 }}>
          As prioridades abaixo foram derivadas diretamente da análise sistêmica MFIS™ e dos scores de maturidade.
          A ordem reflete impacto esperado e urgência — não apenas dificuldade de execução.
        </p>
      </div>

      {/* Priority cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {cards.map((card, i) => {
          const s = CARD_STYLES[i];
          return (
            <div key={i} style={{
              border: `1px solid ${s.accent}33`,
              borderLeft: `4px solid ${s.accent}`,
              borderRadius: 10, padding: '20px 22px',
              background: '#fff',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: s.numBg, color: s.numText,
                    fontSize: 13, fontWeight: 900,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>{i + 1}</span>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>{card.title}</h3>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 16 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, background: s.tagBg, color: s.tagText, padding: '3px 10px', borderRadius: 9999 }}>{s.tag}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, background: '#f1f5f9', color: '#475569', padding: '3px 10px', borderRadius: 9999 }}>{s.horizon}</span>
                </div>
              </div>

              <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.65, marginBottom: 12 }}>{card.description}</p>

              <div style={{ display: 'flex', gap: 20, marginBottom: 12, flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3, fontWeight: 600 }}>Impacto esperado</p>
                  <p style={{ fontSize: 12, color: '#334155', fontWeight: 600 }}>{card.impact}</p>
                </div>
                <div>
                  <p style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3, fontWeight: 600 }}>Dimensões afetadas</p>
                  <p style={{ fontSize: 12, color: '#334155', fontWeight: 600 }}>{card.affected}</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {card.actions.map((a, ai) => (
                  <div key={ai} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.accent, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#64748b' }}>{a}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}