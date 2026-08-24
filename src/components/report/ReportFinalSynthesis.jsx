/**
 * ReportFinalSynthesis — Página 11
 * Síntese final: mensagem executiva + 3 focos estratégicos
 */
import React from 'react';

/**
 * @param {Object} props
 * @param {any=} props.payload
 */
export default function ReportFinalSynthesis({ payload }) {
  const { executive_summary = {}, mfis_analysis = {}, maturity_profile = {}, cover = {} } = payload;
  const { overall_maturity_level, systemic_leverage_dimension, top_risks = [] } = executive_summary;
  const { top_tensions = [] } = mfis_analysis;
  const dimensions = maturity_profile.dimensions || [];
  const criticalDims = dimensions.filter((d) => d.level === 'Crítico' && d.active);
  const topDim = [...dimensions].sort((a, b) => (b.score || 0) - (a.score || 0))[0];

  const foci = [
    {
      label: 'Foco imediato (0–90 dias)',
      color: '#ef4444',
      bg: '#fef2f2',
      text: `Estabilizar ${criticalDims[0]?.name || 'controles críticos'} e iniciar a formalização de processos-chave. Reduzir a principal tensão em ${top_tensions[0]?.crossing_label || 'integração sistêmica'}.`,
    },
    {
      label: 'Foco estruturante (90–180 dias)',
      color: '#f59e0b',
      bg: '#fffbeb',
      text: `Fortalecer ${systemic_leverage_dimension || 'a dimensão de alavanca'} como eixo central. Implementar rotinas de integração entre áreas críticas e consolidar a base de governança.`,
    },
    {
      label: 'Foco de consolidação (180–365 dias)',
      color: '#3b82f6',
      bg: '#eff6ff',
      text: `Maturar os processos estruturados no ciclo anterior. Evoluir as dimensões de ${topDim?.name || 'melhor desempenho'} para nível Avançado e institucionalizar a cadência de monitoramento.`,
    },
  ];

  return (
    <div style={{ padding: '56px 64px', pageBreakAfter: 'always', fontFamily: 'system-ui, sans-serif', background: '#fff', minHeight: '1054px', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <p style={{ fontSize: 9, color: '#10b981', textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700, marginBottom: 6 }}>
          Síntese Final
        </p>
        <h2 style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: -0.5 }}>
          Direcionamento Estratégico
        </h2>
        <div style={{ width: 40, height: 3, background: '#10b981', borderRadius: 2, marginTop: 10 }} />
      </div>

      {/* Executive message */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
        borderRadius: 12, padding: '28px 32px', marginBottom: 36,
      }}>
        <p style={{ fontSize: 11, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700, marginBottom: 14 }}>
          Mensagem Executiva
        </p>
        <p style={{ fontSize: 15, color: '#e2e8f0', lineHeight: 1.8, margin: 0 }}>
          O diagnóstico indica que <strong style={{ color: '#fff' }}>{cover.company_name || 'a organização'}</strong> possui
          base operacional funcional, mas com fragilidades relevantes na integração entre dimensões críticas.
          O nível de maturidade atual é <strong style={{ color: '#fff' }}>{overall_maturity_level || 'Básico'}</strong> —
          com potencial real de evolução estruturada nos próximos 12 meses.
        </p>
        <p style={{ fontSize: 15, color: '#94a3b8', lineHeight: 1.8, margin: '14px 0 0' }}>
          O avanço em <strong style={{ color: '#e2e8f0' }}>{systemic_leverage_dimension || 'governança'}</strong> deve ser
          tratado como prioridade central, pois tende a gerar efeitos positivos sobre a confiabilidade da informação,
          o processo decisório e a execução operacional.
        </p>
      </div>

      {/* 3 strategic focuses */}
      <p style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 18 }}>
        Próximos focos estratégicos
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {foci.map((f, i) => (
          <div key={i} style={{
            display: 'flex', gap: 16, alignItems: 'flex-start',
            padding: '18px 20px',
            background: f.bg, border: `1px solid ${f.color}33`,
            borderLeft: `4px solid ${f.color}`,
            borderRadius: '0 10px 10px 0',
          }}>
            <div style={{ flexShrink: 0 }}>
              <span style={{
                display: 'inline-block', width: 28, height: 28,
                borderRadius: '50%', background: f.color + '22', color: f.color,
                fontSize: 12, fontWeight: 900,
                textAlign: 'center', lineHeight: '28px',
              }}>{i + 1}</span>
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 800, color: f.color, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 6px' }}>{f.label}</p>
              <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.65, margin: 0 }}>{f.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Closing note */}
      <div style={{ marginTop: 36, padding: '14px 18px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc' }}>
        <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.7, margin: 0 }}>
          Recomenda-se atribuir sponsors claros para cada iniciativa e instituir cadência mensal de acompanhamento,
          com métricas visíveis de progresso e revisão trimestral de prioridades.
        </p>
      </div>
    </div>
  );
}