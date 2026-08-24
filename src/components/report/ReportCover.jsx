/**
 * ReportCover — Página 1
 * Hierarquia visual correta: grupo > empresa > unidade
 * Sem textos hardcoded — tudo vem do payload.report_metadata ou payload.cover
 */
import React from 'react';

/**
 * @param {Object} props
 * @param {any=} props.payload
 */
export default function ReportCover({ payload }) {
  const meta = payload?.report_metadata || {};
  const cover = payload?.cover || {};

  // Prioridade: report_metadata > cover (compatibilidade retroativa)
  const advisoryName    = meta.advisory_firm_name  || cover.tenant_name    || '';
  const advisoryLogo    = meta.advisory_logo_url   || cover.tenant_logo_url || null;
  const groupName       = meta.group_name          || cover.group_name      || '';
  const companyName     = meta.company_name        || (cover.company_name !== cover.group_name ? cover.company_name : '') || '';
  const unitName        = meta.unit_name           || cover.unit_name       || '';
  const recipientName   = meta.recipient_name      || cover.recipient_name  || '';
  const recipientTitle  = meta.recipient_title     || cover.recipient_title || '';
  const recipientLabel  = meta.recipient_label     || '';
  const reportLevel     = payload?.report_scope?.level || payload?.meta?.reportScope || 'company';

  // Data de conclusão do diagnóstico (nunca data de criação)
  const completionRaw = meta.completion_date || cover.completion_date || cover.assessment_date;
  const completionDate = completionRaw
    ? new Date(completionRaw).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : cover.competence || '—';

  const methodVersion = cover.method_version || 'FAL v1.0';
  const cycleNumber   = cover.cycle_number || 1;
  const competence    = cover.competence || '';

  // Protagonista da capa conforme nível
  const heroName = reportLevel === 'group'
    ? groupName
    : reportLevel === 'unit'
    ? groupName || companyName
    : groupName || companyName;

  return (
    <div style={{
      width: '100%', minHeight: '1054px',
      background: '#fff',
      display: 'flex', flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '72px 64px',
      pageBreakAfter: 'always',
      boxSizing: 'border-box',
    }}>
      {/* Topo: logo da advisory firm */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 52 }}>
          {advisoryLogo ? (
            <img
              src={advisoryLogo}
              alt={advisoryName || 'Logo'}
              style={{ maxHeight: 52, maxWidth: 200, objectFit: 'contain' }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#334155' }}>
                {advisoryName || 'FAL® Digital'}
              </span>
            </div>
          )}
        </div>

        {/* Linha azul */}
        <div style={{ width: 56, height: 3, background: '#3b82f6', borderRadius: 2, marginBottom: 52 }} />

        {/* Tipo de documento */}
        <p style={{
          fontSize: 11, color: '#94a3b8', letterSpacing: 3,
          textTransform: 'uppercase', fontWeight: 600, marginBottom: 18,
        }}>
          Diagnóstico organizacional · Método FAL™
        </p>

        {/* Hierarquia principal: GRUPO em destaque máximo */}
        {heroName && (
          <h1 style={{
            fontSize: 48, fontWeight: 900, color: '#0f172a',
            lineHeight: 1.05, margin: 0, letterSpacing: -1.5,
          }}>
            {heroName}
          </h1>
        )}

        {/* Empresa: subtítulo institucional */}
        {companyName && companyName !== heroName && (
          <p style={{ fontSize: 20, color: '#334155', marginTop: 10, fontWeight: 600, letterSpacing: -0.3 }}>
            {companyName}
          </p>
        )}

        {/* Unidade: texto complementar */}
        {unitName && unitName !== '—' && (
          <p style={{ fontSize: 15, color: '#94a3b8', marginTop: 6, fontWeight: 400 }}>
            {unitName}
          </p>
        )}
      </div>

      {/* Metadados do diagnóstico */}
      <div style={{ margin: '44px 0' }}>
        <div style={{
          borderLeft: '3px solid #3b82f6', paddingLeft: 22,
          display: 'flex', flexDirection: 'column', gap: 0,
        }}>
          <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4, fontWeight: 700 }}>
                Conclusão do diagnóstico
              </p>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{completionDate}</p>
            </div>
            <div>
              <p style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4, fontWeight: 700 }}>
                Versão do método
              </p>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{methodVersion}</p>
            </div>
            <div>
              <p style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4, fontWeight: 700 }}>
                Ciclo
              </p>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>#{cycleNumber}</p>
            </div>
            {competence && (
              <div>
                <p style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4, fontWeight: 700 }}>
                  Competência
                </p>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{competence}</p>
              </div>
            )}
          </div>

          {(recipientName || recipientLabel) && (
            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4, fontWeight: 700 }}>
                Destinatário
              </p>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>
                <p>{recipientName}</p>
                {recipientTitle && <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>— {recipientTitle}</p>}
              </div>
              {recipientLabel && (
                <p style={{ fontSize: 12, fontWeight: 400, color: '#64748b', marginTop: 2 }}>{recipientLabel}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Rodapé */}
      <div style={{
        borderTop: '1px solid #e2e8f0', paddingTop: 22,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <p style={{ fontSize: 11, color: '#cbd5e1' }}>
          Este relatório é de uso exclusivo do destinatário.
        </p>
        <p style={{ fontSize: 11, color: '#cbd5e1' }}>
          {advisoryName || 'FAL® Digital'}
        </p>
      </div>
    </div>
  );
}