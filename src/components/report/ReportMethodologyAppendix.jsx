/**
 * ReportMethodologyAppendix — Página 12
 * Apêndice metodológico: FAL, IFME, MQE, MFIS + escala de avaliação
 */
import React from 'react';

const METHODOLOGIES = [
  {
    key: 'FAL',
    title: 'Método FAL™',
    color: '#0f172a',
    bg: '#f8fafc',
    border: '#e2e8f0',
    text: 'O Framework de Avaliação de Liderança e Gestão (FAL™) é uma metodologia proprietária de diagnóstico organizacional que avalia a maturidade estrutural de empresas em 8 dimensões críticas. O método combina análise quantitativa, qualitativa e sistêmica para produzir diagnósticos acionáveis.',
  },
  {
    key: 'IFME',
    title: 'IFME™ — Índice FAL de Maturidade Empresarial',
    color: '#3b82f6',
    bg: '#eff6ff',
    border: '#bfdbfe',
    text: 'O IFME™ consolida os scores das 8 dimensões em um índice único de maturidade organizacional, variando de 0% a 100%. Permite comparação histórica entre ciclos de diagnóstico e benchmarking setorial. É o indicador-síntese de saúde organizacional do Método FAL.',
  },
  {
    key: 'MQE',
    title: 'MQE™ — Módulo de Qualidade dos Cruzamentos',
    color: '#6366f1',
    bg: '#f5f3ff',
    border: '#c4b5fd',
    text: 'O MQE™ avalia a interdependência direta entre pares de dimensões organizacionais. Identifica se duas áreas operam de forma integrada ou em silos. Complementa o IFME ao revelar tensões que não aparecem na análise unidimensional.',
  },
  {
    key: 'MFIS',
    title: 'MFIS™ — Matriz FAL de Interdependência Sistêmica',
    color: '#6366f1',
    bg: '#f5f3ff',
    border: '#c4b5fd',
    text: 'A MFIS™ mapeia todas as interdependências entre dimensões em uma matriz relacional. Identifica pontos de alavanca sistêmica — dimensões cuja evolução gera impacto multiplicador — e revela rupturas estruturais que limitam a escalabilidade da organização.',
  },
];

const DIMENSIONS_8D = [
  {
    key: 'GOV', label: 'Governança',
    color: '#0f172a', bg: '#f8fafc', border: '#e2e8f0',
    narrative: 'Avalia o grau de estruturação do processo decisório, a clareza de papéis e a existência de mecanismos formais que sustentem a gestão. Fragilidades nessa dimensão tendem a gerar dependência excessiva de pessoas-chave, baixa previsibilidade e limitações à escalabilidade.',
  },
  {
    key: 'JUR', label: 'Jurídico / Societário',
    color: '#6366f1', bg: '#f5f3ff', border: '#c4b5fd',
    narrative: 'Observa-se o nível de formalização das relações e a robustez da estrutura legal da empresa. A ausência de alinhamento contratual e societário adequado pode expor o negócio a riscos relevantes, especialmente em cenários de crescimento, conflito ou sucessão.',
  },
  {
    key: 'CTR', label: 'Controles Internos',
    color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd',
    narrative: 'Analisa a existência e a efetividade de mecanismos que asseguram a integridade das operações. Falhas nessa camada costumam se traduzir em perdas financeiras silenciosas, inconsistências operacionais e maior exposição a erros e desvios.',
  },
  {
    key: 'FIN', label: 'Financeiro',
    color: '#047857', bg: '#f0fdf4', border: '#bbf7d0',
    narrative: 'A análise concentra-se na capacidade da empresa de gerir seus recursos com previsibilidade e controle. Mais do que o resultado apurado, avalia-se a qualidade da gestão de caixa, a estrutura de capital e a capacidade de sustentar o crescimento com equilíbrio financeiro.',
  },
  {
    key: 'CON', label: 'Contábil',
    color: '#92400e', bg: '#fffbeb', border: '#fde68a',
    narrative: 'Examina a confiabilidade das informações que suportam a tomada de decisão. Quando a contabilidade não reflete com precisão a realidade econômica do negócio, a empresa passa a operar com baixa visibilidade, comprometendo decisões estratégicas e operacionais.',
  },
  {
    key: 'TRI', label: 'Fiscal / Tributário',
    color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe',
    narrative: 'Avalia-se o nível de eficiência e segurança na gestão tributária. É recorrente a identificação de distorções, seja por recolhimento superior ao necessário ou por exposição a riscos fiscais não mapeados, ambos com impacto direto no resultado e na segurança do negócio.',
  },
  {
    key: 'OPE', label: 'Operacional / Cultura e Ambiente',
    color: '#b45309', bg: '#fff7ed', border: '#fed7aa',
    narrative: 'Concentra-se na forma como a estratégia se materializa na prática. São analisados processos, rotinas, nível de organização e comportamento da equipe. Ineficiências nessa camada tendem a gerar retrabalho, baixa produtividade e desgaste operacional.',
  },
  {
    key: 'SIS', label: 'Tecnologia',
    color: '#0e7490', bg: '#ecfeff', border: '#a5f3fc',
    narrative: 'Avalia-se o papel dos sistemas como habilitadores da eficiência e da escala. Ambientes tecnológicos fragmentados ou excessivamente dependentes de controles paralelos limitam a confiabilidade das informações e aumentam o esforço operacional.',
  },
];

const MATURITY_SCALE = [
  { range: '0.00 – 0.75', level: 'Crítico',     color: '#ef4444', bg: '#fef2f2', desc: 'Ausência ou colapso estrutural. Processos inexistentes ou disfuncionais. Intervenção imediata necessária.' },
  { range: '0.75 – 1.50', level: 'Básico',       color: '#f59e0b', bg: '#fffbeb', desc: 'Práticas informais e inconsistentes. Há alguma estrutura, mas sem formalização e com baixa previsibilidade.' },
  { range: '1.50 – 2.25', level: 'Estruturado',  color: '#3b82f6', bg: '#eff6ff', desc: 'Processos formalizados e regularmente executados. Base sólida para evolução com foco em automação e melhoria.' },
  { range: '2.25 – 3.00', level: 'Avançado',     color: '#22c55e', bg: '#f0fdf4', desc: 'Alta maturidade e integração. Referência interna de boas práticas. Foco em inovação e sustentabilidade.' },
];

/**
 * @param {Object} props
 * @param {any=} props.payload
 */
export default function ReportMethodologyAppendix({ payload }) {
  const { cover = {} } = payload;

  return (
    <div style={{ padding: '56px 64px', fontFamily: 'system-ui, sans-serif', background: '#fff', minHeight: '1054px', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700, marginBottom: 6 }}>
          Apêndice Metodológico
        </p>
        <h2 style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: -0.5 }}>
          Metodologia e frameworks do Método FAL™
        </h2>
        <div style={{ width: 40, height: 3, background: '#64748b', borderRadius: 2, marginTop: 10 }} />
      </div>

      {/* Methodology blocks */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 36 }}>
        {METHODOLOGIES.map((m) => (
          <div key={m.key} style={{
            padding: '18px 20px',
            background: m.bg,
            border: `1px solid ${m.border}`,
            borderRadius: 10,
          }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: m.color, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {m.title}
            </p>
            <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.7, margin: 0 }}>{m.text}</p>
          </div>
        ))}
      </div>

      {/* Leitura Estruturada das Dimensões */}
      <div style={{ marginBottom: 36 }}>
        <p style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>
          Leitura Estruturada das Dimensões — Visão Integrada de Gestão
        </p>
        <div style={{ width: 40, height: 2, background: '#64748b', borderRadius: 2, marginBottom: 18 }} />

        {/* Introdução */}
        <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.8, marginBottom: 20 }}>
          O diagnóstico foi estruturado em oito dimensões fundamentais que, em conjunto, representam os principais vetores de sustentação, controle e crescimento da empresa. A análise parte de uma visão sistêmica, na qual os resultados observados não são tratados de forma isolada, mas como reflexo da interação entre diferentes camadas da gestão.
        </p>

        {/* Blocos narrativos por dimensão */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {DIMENSIONS_8D.map((d) => (
            <div key={d.key} style={{ display: 'flex', gap: 14, padding: '13px 16px', background: d.bg, border: `1px solid ${d.border}`, borderRadius: 8 }}>
              <span style={{
                fontSize: 9, fontWeight: 900, color: d.color, background: d.border,
                padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap',
                alignSelf: 'flex-start', letterSpacing: 0.5, marginTop: 2,
              }}>{d.key}</span>
              <div>
                <p style={{ fontSize: 11, fontWeight: 800, color: d.color, margin: '0 0 4px 0' }}>{d.label}</p>
                <p style={{ fontSize: 11, color: '#475569', margin: 0, lineHeight: 1.7 }}>{d.narrative}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Conclusão */}
        <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.8, marginTop: 20, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
          De forma consolidada, esta estrutura permite identificar não apenas pontos de melhoria isolados, mas, principalmente, os fatores estruturais que limitam o desempenho e a capacidade de crescimento sustentável da empresa.
        </p>
      </div>

      {/* Maturity scale */}
      <div>
        <p style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 }}>
          Escala de Avaliação (0 a 3)
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #0f172a' }}>
              {['Faixa', 'Nível', 'Descrição'].map((h) => (
                <th key={h} style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATURITY_SCALE.map((s) => (
              <tr key={s.level} style={{ borderBottom: '1px solid #f1f5f9', background: '#fff' }}>
                <td style={{ padding: '12px 10px', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: s.color, whiteSpace: 'nowrap' }}>{s.range}</td>
                <td style={{ padding: '12px 10px' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, background: s.bg, color: s.color, padding: '4px 12px', borderRadius: 9999 }}>
                    {s.level}
                  </span>
                </td>
                <td style={{ padding: '12px 10px' }}>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.5 }}>{s.desc}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 36, borderTop: '1px solid #e2e8f0', paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: 10, color: '#cbd5e1' }}>
          Versão do método: {cover.method_version || 'FAL v1.0'} · Todos os direitos reservados.
        </p>
        <p style={{ fontSize: 10, color: '#cbd5e1' }}>
          {(payload?.report_metadata?.advisory_firm_name || cover.tenant_name || 'FAL® Digital')}
        </p>
      </div>
    </div>
  );
}