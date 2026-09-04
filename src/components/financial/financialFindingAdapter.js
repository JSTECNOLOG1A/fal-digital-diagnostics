/**
 * financialFindingAdapter
 * Único ponto de leitura dos campos de FinancialFinding/FinancialRecommendation
 * usados pelas telas de análise (Demonstrações e Indicadores).
 *
 * Existe para isolar a Fase 2 (roadmap do motor de 11 blocos, com taxonomia
 * nova de achado): quando o schema migrar, só este arquivo muda — os
 * componentes de tela continuam chamando as mesmas funções.
 */

export const SEVERITY_META = {
  low: { label: 'Baixa', accent: '#94a3b8' },
  medium: { label: 'Média', accent: '#D9A420' },
  high: { label: 'Alta', accent: '#D97706' },
  critical: { label: 'Crítica', accent: '#DC2626' },
};

export const SCOPE_LABEL = {
  period_snapshot: 'Leitura do período',
  period_comparison: 'Evolução',
  structural_validation: 'Validações estruturais',
};

// source_type que compõe a seção "Demonstrações Financeiras" (BP/DRE/DFC).
const STATEMENTS_SOURCE_TYPES = new Set(['financial_statement', 'financial_validation', 'dfc']);
// source_type que compõe a seção "Indicadores Financeiros".
const INDICATOR_SOURCE_TYPES = new Set(['financial_indicator']);

export function getFindingSeverity(finding) {
  return SEVERITY_META[finding?.severity] || SEVERITY_META.low;
}

export function getFindingScopeLabel(finding) {
  return SCOPE_LABEL[finding?.finding_scope] || 'Outros';
}

/** @returns {'statements'|'indicators'|'other'} */
export function getFindingSection(finding) {
  if (STATEMENTS_SOURCE_TYPES.has(finding?.source_type)) return 'statements';
  if (INDICATOR_SOURCE_TYPES.has(finding?.source_type)) return 'indicators';
  return 'other';
}

export function filterFindingsBySection(findings, section) {
  return (findings || []).filter((f) => getFindingSection(f) === section);
}

export function isFindingInActionPlan(finding) {
  return finding?.action_plan_status === 'converted_to_task' && !!finding?.action_task_id;
}

export function isProposalExported(proposal) {
  return proposal?.status === 'exported' && !!proposal?.fal_action_task_id;
}
