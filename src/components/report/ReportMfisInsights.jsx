/**
 * ReportMfisInsights — Diagnóstico sistêmico MFIS™
 * Posição: 3ª no PDF (após sumário executivo) — inteligência principal
 * Conteúdo: tensões, alavanca, narrativa interpretativa robusta
 */
import React from 'react';
import { LABELS, FRAMEWORK_NAMES } from '@/services/report/falDictionary';

function scoreStyle(score) {
  if (score < 1)   return { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' };
  if (score < 1.5) return { color: '#92400e', bg: '#fffbeb', border: '#fcd34d' };
  if (score < 2)   return { color: '#854d0e', bg: '#fef9c3', border: '#fde047' };
  return                  { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' };
}

const TENSION_LEVEL_LABEL = {
  madura:      'Madura',
  funcional:   'Funcional',
  alerta:      'Alerta',
  fragilidade: 'Fragilidade',
  ruptura:     'Ruptura',
};

/**
 * @param {Object} props
 * @param {any=} props.payload
 */
export default function ReportMfisInsights({ payload }) {
  const { mfis_analysis = {}, maturity_profile = {} } = payload;
  const {
    top_tensions = [],
    systemic_leverage_dimension,
    dimension_impacts = [],
    narrative,
  } = mfis_analysis;

  const dimensions    = maturity_profile.dimensions || [];
  const leverageDim   = dimensions.find((d) =>
    d.name === systemic_leverage_dimension || d.key === systemic_leverage_dimension
  );

  // Tensões consolidadas: usa top_tensions ou all_crossings
  const allTensions   = top_tensions.length > 0 ? top_tensions : (mfis_analysis.all_crossings || []);
  const topFive       = allTensions.slice(0, 5);
  const criticalCount = allTensions.filter((t) => (t.cross_score_final ?? t.score ?? 1) < 1).length;

  return (
    <div style={{ padding: '56px 64px', pageBreakAfter: 'always', fontFamily: 'system-ui, sans-serif', background: '#fff', minHeight: '1054px', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 9, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700, marginBottom: 6 }}>
          {FRAMEWORK_NAMES.mfis} — Diagnóstico sistêmico
        </p>
        <h2 style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: -0.5 }}>
          Tensões estruturais e pontos de alavanca
        </h2>
        <div style={{ width: 40, height: 3, background: '#6366f1', borderRadius: 2, marginTop: 10 }} />
      </div>

      {/* Intro contextual */}
      <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7, marginBottom: 28 }}>
        A {FRAMEWORK_NAMES.full.mfis} mapeia as interdependências entre todas as dimensões avaliadas, revelando tensões estruturais que não aparecem na análise unidimensional e identificando onde o esforço de melhoria tem maior efeito multiplicador.
      </p>

      {/* Dois blocos lado a lado */}
      <div style={{ display: 'flex', gap: 28, marginBottom: 28 }}>
        {/* Ranking de tensões */}
        <div style={{ flex: 1.3 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>
              Principais tensões identificadas
            </p>
            {criticalCount > 0 && (
              <span style={{ fontSize: 10, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 99, padding: '2px 10px', fontWeight: 700 }}>
                {criticalCount} em nível crítico
              </span>
            )}
          </div>

          {topFive.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  {['#', 'Cruzamento', 'Score', 'Nível'].map((h) => (
                    <th key={h} style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topFive.map((t, i) => {
                  const score = t.cross_score_final ?? t.score ?? 0;
                  const s = scoreStyle(score);
                  const tlabel = TENSION_LEVEL_LABEL[t.tension_level] || '—';
                  return (
                    <tr key={t.crossing_key || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{
                          width: 22, height: 22, borderRadius: '50%',
                          background: s.bg, color: s.color, border: `1px solid ${s.border}`,
                          fontSize: 11, fontWeight: 800,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        }}>{i + 1}</span>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                          {t.crossing_label || t.crossing_key}
                        </p>
                        {t.risk_summary && (
                          <p style={{ fontSize: 10, color: '#64748b', margin: '2px 0 0', lineHeight: 1.4 }}>
                            {t.risk_summary}
                          </p>
                        )}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: s.color }}>
                          {score?.toFixed ? score.toFixed(2) : '—'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        {t.tension_level && (
                          <span style={{ fontSize: 10, fontWeight: 700, background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 99 }}>
                            {tlabel}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
              Análise MFIS™ não disponível para este ciclo. Execute o diagnóstico sistêmico para gerar os cruzamentos.
            </p>
          )}
        </div>

        {/* Ponto de alavanca */}
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
            {LABELS.leverage_point}
          </p>

          {systemic_leverage_dimension ? (
            <div style={{ padding: '22px 20px', background: '#eff6ff', border: '2px solid #bfdbfe', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>⚡</span>
                <p style={{ fontSize: 18, fontWeight: 900, color: '#1e40af', margin: 0 }}>
                  {systemic_leverage_dimension}
                </p>
              </div>
              {leverageDim && (
                <p style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                  Score atual: <strong style={{ color: '#0f172a' }}>
                    {leverageDim.score?.toFixed ? leverageDim.score.toFixed(2) : '—'}/3,00
                  </strong>
                </p>
              )}
              <p style={{ fontSize: 12, color: '#1d4ed8', lineHeight: 1.7, margin: 0 }}>
                A dimensão <strong>{systemic_leverage_dimension}</strong> foi identificada como principal ponto de alavanca. Sua evolução tende a melhorar coordenação, disciplina decisória e sustentação dos controles em toda a organização.
              </p>
            </div>
          ) : (
            <div style={{ padding: '18px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10 }}>
              <p style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>
                Ponto de alavanca não identificado neste ciclo.
              </p>
            </div>
          )}

          {/* Top dimensões por alavancagem */}
          {dimension_impacts.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                {LABELS.leverage_dims}
              </p>
              {[...dimension_impacts]
                .sort((a, b) => (b.leverage_score || 0) - (a.leverage_score || 0))
                .slice(0, 5)
                .map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', width: 14 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 12, color: '#334155', fontWeight: 600 }}>
                    {d.dimension_label || '—'}
                  </span>
                  <div style={{ width: 72, height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, ((d.leverage_score || 0) / 3) * 100)}%`,
                      background: d.is_systemic_leverage_point ? '#3b82f6' : '#94a3b8',
                      borderRadius: 3,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Narrativa interpretativa */}
      {narrative && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '20px 24px' }}>
          <p style={{ fontSize: 9, color: '#6366f1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
            {LABELS.consultive_interp}
          </p>
          {narrative.split('\n\n').filter(Boolean).map((para, i) => (
            <p key={i} style={{ fontSize: 13, color: '#334155', lineHeight: 1.75, marginBottom: 8 }}>
              {para.replace(/\*\*/g, '')}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}