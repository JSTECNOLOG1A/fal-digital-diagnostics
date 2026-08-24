/**
 * ReportRenderer — Renderizador modular que compõe seções conforme o tipo de relatório
 * Define a ordem de seções para cada combinação (scope, mode)
 */
import React from 'react';
import {
  CoverSection,
  ExecutiveSummarySection,
  CoverageSection,
  DimensionProfileSection,
  MethodologySection,
} from './ReportSectionLibrary';
import ReportFragilities         from './ReportFragilities';
import ReportMfisInsights        from './ReportMfisInsights';
import ReportStrategicPriorities from './ReportStrategicPriorities';
import ReportActionPlan90        from './ReportActionPlan90';
import ReportFinalSynthesis      from './ReportFinalSynthesis';

// Importar outras seções conforme forem criadas
// import { ActionPlanSection, MFISSection, CompanyZoomSection, etc. }

/**
 * Ordem de seções por tipo de relatório
 */
const REPORT_SECTION_ORDER = {
  'group:executive': [
    'cover', 'executiveSummary', 'mfisInsights', 'coverage',
    'dimensionProfile', 'fragilities', 'strategicPriorities',
    'actionPlan90', 'finalSynthesis', 'methodology',
  ],
  'group:full_scope': [
    'cover', 'executiveSummary', 'mfisInsights', 'coverage',
    'dimensionProfile', 'fragilities', 'strategicPriorities',
    'actionPlan90', 'finalSynthesis', 'methodology',
  ],
  'company:tactical': [
    'cover', 'executiveSummary', 'mfisInsights', 'coverage',
    'dimensionProfile', 'fragilities', 'strategicPriorities',
    'actionPlan90', 'finalSynthesis', 'methodology',
  ],
  'unit:operational': [
    'cover', 'executiveSummary', 'dimensionProfile',
    'fragilities', 'actionPlan90', 'methodology',
  ],
};

/**
 * Mapa de componentes de seção
 */
const SECTION_COMPONENTS = {
  cover:               CoverSection,
  executiveSummary:    ExecutiveSummarySection,
  coverage:            CoverageSection,
  dimensionProfile:    DimensionProfileSection,
  fragilities:         ReportFragilities,
  mfisInsights:        ReportMfisInsights,
  strategicPriorities: ReportStrategicPriorities,
  actionPlan90:        ReportActionPlan90,
  finalSynthesis:      ReportFinalSynthesis,
  methodology:         MethodologySection,
};

/**
 * ReportRenderer — componente principal
 * @param {Object} payload — payload canônico do relatório
 * @param {string} reportScope — 'group', 'company', 'unit'
 * @param {string} reportMode — 'executive', 'full_scope', 'tactical', 'operational'
 */
export default function ReportRenderer({ payload, reportScope, reportMode }) {
   const key = `${reportScope}:${reportMode}`;
   const sectionIds = REPORT_SECTION_ORDER[key] || [];

   if (!payload) {
     console.error('[ReportRenderer] Payload vazio');
     return (
       <div style={{ padding: '56px 64px', fontFamily: 'system-ui', background: '#fff' }}>
         <p style={{ color: '#94a3b8', fontSize: 12 }}>Payload vazio ou inválido</p>
       </div>
     );
   }

   if (sectionIds.length === 0) {
     console.warn(`[ReportRenderer] Nenhuma seção encontrada para ${key}`);
   }

   console.log('[ReportRenderer] Renderizando:', { key, sectionCount: sectionIds.length, sections: sectionIds });

   return (
     <div id="fal-diagnostic-report" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", background: '#fff', width: '100%' }}>
       {sectionIds.map((sectionId, idx) => {
         const Component = SECTION_COMPONENTS[sectionId];
         if (!Component) {
           console.warn(`[ReportRenderer] Seção '${sectionId}' sem componente — pulando`);
           return null;
         }

        return (
          <div key={sectionId} className="report-section" data-section={sectionId} style={{ position: 'relative' }}>
            <Component payload={payload} />
            {/* Page number */}
            <div style={{
              position: 'absolute',
              bottom: 24,
              right: 64,
              fontSize: 10,
              color: '#cbd5e1',
              fontFamily: 'system-ui, sans-serif',
            }}>
              {idx + 1}
            </div>
          </div>
        );
      })}
    </div>
  );
}