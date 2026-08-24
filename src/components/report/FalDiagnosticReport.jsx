/**
 * FalDiagnosticReport — Orquestrador Principal
 * 10 seções / páginas — estrutura Big4 / consultoria estratégica
 *
 * Ordem:
 *  1.  Capa
 *  2.  Sumário Executivo
 *  3.  Metodologia e Frameworks (Apêndice Metodológico)
 *  4.  Diagnóstico Sistêmico (MFIS)
 *  5.  Cobertura do Diagnóstico
 *  6.  Perfil por Dimensão
 *  7.  Fragilidades Estruturais
 *  8.  Prioridades Estratégicas
 *  9.  Plano de Ação — 90 Dias
 * 10.  Síntese Final
 */
import React from 'react';
import ReportCover                from './ReportCover';
import ReportExecutiveSummary     from './ReportExecutiveSummary';
import ReportMaturityOverview     from './ReportMaturityOverview';
import ReportDetailedMatrixByDimension from './ReportDetailedMatrixByDimension';
import ReportMaturityDetail       from './ReportMaturityDetail';
import ReportFragilities          from './ReportFragilities';
import ReportMfisInsights         from './ReportMfisInsights';
import ReportStrategicPriorities  from './ReportStrategicPriorities';
import ReportActionPlan90         from './ReportActionPlan90';
import ReportFinalSynthesis       from './ReportFinalSynthesis';
import ReportMethodologyAppendix  from './ReportMethodologyAppendix';

export const REPORT_SECTION_ORDER = [
  { id: 'cover',                Component: ReportCover,                      label: 'Capa',                        page: 1  },
  { id: 'executive_summary',    Component: ReportExecutiveSummary,           label: 'Sumário executivo',           page: 2  },
  { id: 'methodology',          Component: ReportMethodologyAppendix,        label: 'Metodologia',                 page: 3  },
  { id: 'mfis_insights',        Component: ReportMfisInsights,               label: 'Diagnóstico sistêmico',       page: 4  },
  { id: 'coverage',             Component: ReportMaturityOverview,           label: 'Cobertura do diagnóstico',    page: 5  },
  { id: 'detailed_matrix',      Component: ReportDetailedMatrixByDimension,  label: 'Matriz dimensional',          page: 6  },
  { id: 'dimension_profile',    Component: ReportMaturityDetail,             label: 'Dimensões aplicáveis',        page: 7  },
  { id: 'fragilities',          Component: ReportFragilities,                label: 'Fragilidades estruturais',    page: 8  },
  { id: 'strategic_priorities', Component: ReportStrategicPriorities,        label: 'Prioridades estratégicas',    page: 9  },
  { id: 'action_plan_90',       Component: ReportActionPlan90,               label: 'Plano de ação — 90 dias',    page: 10 },
  { id: 'final_synthesis',      Component: ReportFinalSynthesis,             label: 'Síntese final',               page: 11 },
];

/**
 * Props:
 *   payload         — enrichedReportPayload
 *   sectionFilter   — string[] | null (renderizar só seções pelo id)
 *   showPageNumbers — boolean
 */
export default function FalDiagnosticReport({ payload, sectionFilter, showPageNumbers = true }) {
   if (!payload) {
     console.error('[FalDiagnosticReport] Payload vazio');
     return null;
   }

   const sections = sectionFilter
     ? REPORT_SECTION_ORDER.filter((s) => sectionFilter.includes(s.id))
     : REPORT_SECTION_ORDER;

   console.log('[FalDiagnosticReport]', {
     sections: sections.map(s => s.id),
     metadata: payload?.report_metadata,
     scope: payload?.report_scope,
   });

  return (
    <div
      id="fal-diagnostic-report"
      style={{
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        background: '#fff',
        width: '100%',
        maxWidth: 900,
        margin: '0 auto',
      }}
    >
      {sections.map(({ id, Component, page }, idx) => {
        if (!Component) {
          console.warn(`[FalDiagnosticReport] Seção '${id}' sem componente registrado — ignorada`);
          return null;
        }

        return (
          <div
            key={id}
            className="report-section"
            data-section={id}
            style={{ position: 'relative' }}
          >
            <Component payload={payload} />

            {showPageNumbers && (
              <div style={{
                position: 'absolute',
                bottom: 24,
                right: 64,
                fontSize: 10,
                color: '#cbd5e1',
                fontFamily: 'system-ui, sans-serif',
              }}>
                {sectionFilter ? idx + 1 : page}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}