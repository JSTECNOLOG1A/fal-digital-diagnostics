/**
 * Report Types & Enums
 * Definição centralizada de tipos, modos e combinações válidas de relatórios
 */

export const ReportScope = {
  GROUP:  'group',
  COMPANY: 'company',
  UNIT:   'unit',
};

export const ReportMode = {
  EXECUTIVE:   'executive',
  FULL_SCOPE:  'full_scope',
  TACTICAL:    'tactical',
  OPERATIONAL: 'operational',
};

/**
 * Combinações válidas de (scope, mode)
 */
export const VALID_REPORT_COMBINATIONS = [
  { scope: 'group',   mode: 'executive' },
  { scope: 'group',   mode: 'full_scope' },
  { scope: 'company', mode: 'tactical' },
  { scope: 'unit',    mode: 'operational' },
];

export function isValidReportCombination(scope, mode) {
  return VALID_REPORT_COMBINATIONS.some(
    combo => combo.scope === scope && combo.mode === mode
  );
}

/**
 * Titles padrão para cada tipo de relatório
 */
export const REPORT_TITLES = {
  'group:executive':   'Relatório Executivo do Grupo',
  'group:full_scope':  'Relatório Consolidado',
  'company:tactical':  'Relatório da Empresa',
  'unit:operational':  'Relatório da Unidade',
};

export function getReportTitle(scope, mode, entityName) {
  const key = `${scope}:${mode}`;
  const baseTitle = REPORT_TITLES[key] || `Relatório`;
  return entityName ? `${baseTitle} — ${entityName}` : baseTitle;
}

/**
 * Configuração de profundidade por tipo
 */
export const REPORT_DEPTH_CONFIG = {
  'group:executive': {
    maxClusterDetailLevel: 'high-level',
    includeMFIS: false,
    includeFullActionPlan: false,
    maxEntitiesDetailPerCategory: 3,
    includeUnitLevel: false,
  },
  'group:full_scope': {
    maxClusterDetailLevel: 'detailed',
    includeMFIS: true,
    includeFullActionPlan: true,
    maxEntitiesDetailPerCategory: 999,
    includeUnitLevel: true,
  },
  'company:tactical': {
    maxClusterDetailLevel: 'detailed',
    includeMFIS: false,
    includeFullActionPlan: true,
    maxEntitiesDetailPerCategory: 1,
    includeUnitLevel: true,
  },
  'unit:operational': {
    maxClusterDetailLevel: 'detailed',
    includeMFIS: false,
    includeFullActionPlan: true,
    maxEntitiesDetailPerCategory: 1,
    includeUnitLevel: false,
  },
};

export function getDepthConfig(scope, mode) {
  const key = `${scope}:${mode}`;
  return REPORT_DEPTH_CONFIG[key] || {};
}