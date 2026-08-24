import { GENERATED_BACKEND_REGISTRY } from './generatedFinancialBackendEngine.js';

export const REGISTRY_VERSION = '3.0.0';
export const FORMULA_VERSION = 'FAL-FIN-3.0.0';

export const SOURCE_RUBRICS = Object.fromEntries(Object.entries(GENERATED_BACKEND_REGISTRY.rubrics).map(([key, meta]) => [key, {
  ...meta,
  classification: 'SOURCE_CANONICAL_RUBRIC',
  eliminationEligible: meta.elimination_eligible === true,
  statement: meta.statement_code,
  group: meta.presentation_group,
  normalBalance: meta.normal_balance,
  dfc: meta.dfc_treatment,
}]));

export const CALCULATED_RUBRICS = Object.fromEntries(Object.entries(GENERATED_BACKEND_REGISTRY.calculated).map(([key, meta]) => [key, {
  ...meta,
  classification: 'CALCULATED_STATEMENT_RUBRIC',
  statement: meta.statement_code,
  terms: meta.operands.map((operand, index) => [operand, meta.coefficients[index]]),
}]));

export const STATEMENT_TOTALS = Object.fromEntries(Object.entries(GENERATED_BACKEND_REGISTRY.totals).map(([key, meta]) => [key, {
  ...meta,
  classification: 'STATEMENT_TOTAL',
  statement: meta.statement_code,
  terms: meta.component_keys.map((component) => [component, 1]),
}]));

const indicator = (family, numerator, denominator = null) => ({ classification: 'FINANCIAL_INDICATOR', family, numerator, denominator });
export const INDICATORS = {
  liquidez_corrente: indicator('liquidez', 'total_ativo_circulante', 'total_passivo_circulante'),
  liquidez_seca: indicator('liquidez', 'ativo_circulante_sem_estoques', 'total_passivo_circulante'),
  liquidez_imediata: indicator('liquidez', 'disponibilidade_imediata', 'total_passivo_circulante'),
  liquidez_geral: indicator('liquidez', 'ativo_realizavel_total', 'passivo_exigivel_total'),
  capital_circulante_liquido: indicator('capital_giro', 'total_ativo_circulante-total_passivo_circulante'),
  passivo_sobre_ativo: indicator('endividamento', 'total_passivo', 'total_ativo'),
  capital_terceiros_sobre_pl: indicator('estrutura_capital', 'total_passivo', 'total_patrimonio_liquido'),
  divida_liquida: indicator('endividamento', 'divida_bruta-disponibilidade_imediata'),
  divida_liquida_sobre_ebitda: indicator('endividamento', 'divida_liquida', 'ebitda'),
  composicao_endividamento: indicator('endividamento', 'total_passivo_circulante', 'total_passivo'),
  margem_bruta: indicator('margens', 'lucro_bruto', 'receita_liquida'),
  margem_ebit: indicator('margens', 'ebit', 'receita_liquida'),
  margem_ebitda: indicator('margens', 'ebitda', 'receita_liquida'),
  margem_liquida: indicator('margens', 'resultado_liquido', 'receita_liquida'),
  roa: indicator('rentabilidade', 'resultado_liquido', 'total_ativo'),
  roe: indicator('rentabilidade', 'resultado_liquido', 'total_patrimonio_liquido'),
  giro_ativo: indicator('atividade', 'receita_liquida', 'total_ativo'),
  prazo_medio_recebimento: indicator('atividade', 'clientes*360', 'receita_bruta'),
  prazo_medio_pagamento: indicator('atividade', 'fornecedores*360', 'abs(custos)'),
  prazo_medio_estoque: indicator('atividade', 'estoques*360', 'abs(custos)'),
  ciclo_operacional: indicator('atividade', 'prazo_medio_recebimento+prazo_medio_estoque'),
  ciclo_financeiro: indicator('atividade', 'ciclo_operacional-prazo_medio_pagamento'),
  kanitz_fator_insolvencia: indicator('solvencia', 'kanitz_formula'),
};

export const UI_ONLY_KEYS = ['individual', 'combined', 'consolidated', 'periodo_atual', 'periodo_anterior', 'dataset_scope', 'entity_code', 'analysis_type'];
export const ALIASES = {
  caixa: 'ativo_circulante_caixa', clientes: 'ativo_circulante_receber', estoques: 'ativo_circulante_estoques',
  fornecedores: 'passivo_circulante_fornecedores', emprestimos_cp: 'passivo_circulante_emprestimos',
  emprestimos_lp: 'passivo_nao_circulante', capital_social: 'patrimonio_capital',
  lucros_prejuizos_acumulados: 'patrimonio_liquido', custo_mercadorias_servicos: 'custo_produtos',
};

export const REGISTRY = { ...SOURCE_RUBRICS, ...CALCULATED_RUBRICS, ...STATEMENT_TOTALS, ...INDICATORS };

export function validateRegistry(registry = REGISTRY) {
  const violations = [];
  const sourceKeys = new Set(Object.keys(SOURCE_RUBRICS));
  const statementKeys = new Set([...sourceKeys, ...Object.keys(CALCULATED_RUBRICS), ...Object.keys(STATEMENT_TOTALS)]);
  for (const key of UI_ONLY_KEYS) if (registry[key]?.classification === 'SOURCE_CANONICAL_RUBRIC') violations.push({ code: 'SERIES_KEY_IN_REGISTRY', key });
  for (const [key, meta] of Object.entries(registry)) {
    if (!meta.classification) violations.push({ code: 'MISSING_CLASSIFICATION', key });
    if (['SOURCE_CANONICAL_RUBRIC', 'CALCULATED_STATEMENT_RUBRIC', 'STATEMENT_TOTAL'].includes(meta.classification) && !meta.statement) violations.push({ code: 'CANONICAL_WITHOUT_STATEMENT', key });
    if (meta.classification === 'FINANCIAL_INDICATOR' && sourceKeys.has(key)) violations.push({ code: 'INDICATOR_AS_RUBRIC', key });
    for (const [dependency] of meta.terms || []) if (!statementKeys.has(dependency)) violations.push({ code: 'FORMULA_KEY_NOT_FOUND', key, dependency });
  }
  for (const alias of Object.keys(ALIASES)) if (sourceKeys.has(alias)) violations.push({ code: 'ALIAS_AS_RUBRIC', key: alias });
  const graph = Object.fromEntries(Object.entries(CALCULATED_RUBRICS).map(([key, meta]) => [key, meta.terms.map(([dep]) => dep).filter(dep => CALCULATED_RUBRICS[dep])]));
  const visit = (key, path = []) => {
    if (path.includes(key)) { violations.push({ code: 'CIRCULAR_DEPENDENCY', key, path: [...path, key] }); return; }
    for (const dep of graph[key] || []) visit(dep, [...path, key]);
  };
  Object.keys(graph).forEach(key => visit(key));
  return { valid: violations.length === 0, violations, counts: { source: sourceKeys.size, calculated: Object.keys(CALCULATED_RUBRICS).length, totals: Object.keys(STATEMENT_TOTALS).length, indicators: Object.keys(INDICATORS).length, ui_only: UI_ONLY_KEYS.length, aliases: Object.keys(ALIASES).length } };
}