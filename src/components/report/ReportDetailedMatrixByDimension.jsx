/**
 * ReportDetailedMatrixByDimension — Matriz detalhada: Dimensão > Subdimensão
 * Exibe cada dimensão com suas subdimensões e clusters
 */
import React from 'react';
import { MATURITY_LEVELS } from '@/services/report/falDictionary';

/**
 * @param {Object} props
 * @param {any=} props.level
 */
function LevelBadge({ level }) {
  const cfg = MATURITY_LEVELS[level] || { text: '#475569', bg: '#f1f5f9' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: cfg.bg, color: cfg.text,
      padding: '3px 8px', borderRadius: 6,
      fontSize: 10, fontWeight: 700,
    }}>
      {level || '—'}
    </span>
  );
}

const OFFICIAL_DIM_ORDER = [
  'governanca', 'juridico', 'controles_internos', 'financeiro',
  'contabil', 'tributario', 'operacional', 'sistemas',
];

const DIM_LABELS = {
  governanca: 'Governança',
  juridico: 'Jurídico / Societário',
  controles_internos: 'Controles Internos',
  financeiro: 'Financeiro',
  contabil: 'Contábil',
  tributario: 'Fiscal / Tributário',
  operacional: 'Operacional',
  sistemas: 'Tecnologia / Sistemas',
};

/**
 * @param {Object} props
 * @param {any=} props.payload
 */
export default function ReportDetailedMatrixByDimension({ payload }) {
  const { maturity_profile = {} } = payload;
  const dimensions = maturity_profile.dimensions || [];
  const activeDims = dimensions.filter((d) => d.active);

  // Ordenar dimensões
  const sortedActiveDims = [...activeDims].sort((a, b) => {
    const aIdx = OFFICIAL_DIM_ORDER.indexOf(a.key);
    const bIdx = OFFICIAL_DIM_ORDER.indexOf(b.key);
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });

  return (
    <div style={{ padding: '56px 64px', pageBreakAfter: 'always', fontFamily: 'system-ui, sans-serif', background: '#fff', minHeight: '1054px', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 9, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700, marginBottom: 6 }}>
          02 · Análise Dimensional
        </p>
        <h2 style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: -0.5 }}>
          Matriz Detalhada — Dimensões & Subdivisões
        </h2>
        <div style={{ width: 40, height: 3, background: '#3b82f6', borderRadius: 2, marginTop: 10 }} />
      </div>

      {/* Descrição */}
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 28, lineHeight: 1.8 }}>
        Análise detalhada de cada dimensão e suas subdivisões. Para cada item, apresentamos o score (0–3), classificação de maturidade e progressão esperada.
      </p>

      {/* Dimensões — uma por linha com expansão de subdivisões */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {sortedActiveDims.map((dim) => {
          const subdims = dim.subdimension_results || {};
          const subdimEntries = Object.entries(subdims).filter(([, sd]) => sd && sd.score !== null);

          return (
            <div key={dim.key} style={{
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              overflow: 'hidden',
              background: '#fff',
            }}>
              {/* Header da dimensão */}
              <div style={{
                background: '#f8fafc',
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0, marginBottom: 4 }}>
                      {DIM_LABELS[dim.key] || dim.name || dim.key}
                    </p>
                    <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>
                      {subdimEntries.length} subdivisão{subdimEntries.length !== 1 ? 'ões' : ''}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0, marginBottom: 2 }}>
                      {dim.score?.toFixed(2) || '—'}
                    </p>
                    <LevelBadge level={dim.level} />
                  </div>
                </div>
              </div>

              {/* Subdivisões */}
              <div style={{ padding: '12px 0' }}>
                {subdimEntries.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {subdimEntries.map(([subKey, subData], idx) => (
                        <tr key={subKey} style={{
                          borderBottom: idx < subdimEntries.length - 1 ? '1px solid #f1f5f9' : 'none',
                          background: idx % 2 === 0 ? '#fff' : '#fafafa',
                        }}>
                          <td style={{ padding: '12px 20px', width: '40%' }}>
                            <p style={{ fontSize: 12, color: '#334155', fontWeight: 600, margin: 0 }}>
                              {subKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </p>
                          </td>
                          <td style={{ padding: '12px 20px', width: '20%', textAlign: 'right' }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                              {subData.score?.toFixed(2) || '—'}
                            </p>
                          </td>
                          <td style={{ padding: '12px 20px', width: '20%', textAlign: 'center' }}>
                            <LevelBadge level={subData.maturity} />
                          </td>
                          <td style={{ padding: '12px 20px', width: '20%', textAlign: 'right' }}>
                            <p style={{ fontSize: 10, color: '#64748b', margin: 0 }}>
                              {subData.answered_questions}/{subData.total_questions} resp.
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: '12px 20px', color: '#94a3b8', fontSize: 12 }}>
                    Nenhuma subdivisão com dados disponíveis.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legenda de interpretação */}
      <div style={{ marginTop: 32, padding: '16px 20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10 }}>
        <p style={{ fontSize: 9, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, margin: 0, marginBottom: 8 }}>
          Legenda
        </p>
        <p style={{ fontSize: 11, color: '#475569', margin: 0, lineHeight: 1.8 }}>
          <strong>Score:</strong> Avaliação em escala 0–3 (Crítico 0–1 | Básico 1–2 | Estruturado 2–2,5 | Avançado 2,5–3).
          <br />
          <strong>Resp.:</strong> Quantidade de respostas coletadas nesta subdivisão / total de perguntas aplicáveis.
        </p>
      </div>
    </div>
  );
}