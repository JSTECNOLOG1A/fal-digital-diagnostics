/**
 * getFinancialCanonicalRegistry — AUTORIDADE CANÔNICA do Registry financeiro.
 *
 * Esta function é a ÚNICA fonte de verdade para:
 *   - Rubricas source (STATEMENT_RUBRIC_REGISTRY)
 *   - Aliases (CANONICAL_ALIASES)
 *   - Compatibilidade legada (LEGACY_CANONICAL_COMPATIBILITY)
 *   - Rubricas calculadas (CALCULATED_RUBRICS)
 *   - Totais (STATEMENT_TOTALS)
 *   - Regras de sinal (SIGN_RULES)
 *   - Regras DFC (DFC_RULES)
 *
 * Outras functions backend consomem via:
 *   const { data } = await base44.functions.invoke('getFinancialCanonicalRegistry', {});
 *
 * Regra dimensional OBRIGATÓRIA:
 *   canonical_key = conceito contábil PURO (nunca contém _consolidado, _parent, etc.)
 *   Contexto de série (dataset_scope, reporting_entity_id, period) → eixos dimensionais, NÃO na key.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

type StatementCode = 'BP' | 'DRE';
type NormalBalance = 'debit' | 'credit' | 'mixed' | 'calculated';
type PresentationSign = 'positive' | 'negative' | 'formula';
type DfcTreatment =
  | 'cash' | 'operating_asset' | 'operating_liability' | 'investing' | 'financing'
  | 'non_cash_adjustment' | 'indirect_result_component' | 'ignored' | 'not_applicable' | 'requires_review';

// ═══════════════════════════════════════════════════════════════════════════
// STATEMENT_RUBRIC_REGISTRY — 44 rubricas source
// ═══════════════════════════════════════════════════════════════════════════

const AC = 'Ativo circulante', ANC = 'Ativo não circulante', PC = 'Passivo circulante';
const PNC = 'Passivo não circulante', PL = 'Patrimônio líquido';
const DRE_REC = 'Receita', DRE_CUSTO = 'Custo', DRE_DESP = 'Despesas operacionais';
const DRE_FIN = 'Resultado financeiro', DRE_IMP = 'Impostos';

const STATEMENT_RUBRIC_REGISTRY = {
  // BP Ativo Circulante (6)
  ativo_circulante_caixa:            { canonical_key: 'ativo_circulante_caixa',          statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: AC,  presentation_order: 10, display_label: 'Caixa e Equivalentes de Caixa',    normal_balance: 'debit',  presentation_sign: 'positive', dfc_treatment: 'cash',                    active: true },
  ativo_circulante_aplicacoes_liquidez_imediata: { canonical_key: 'ativo_circulante_aplicacoes_liquidez_imediata', statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: AC, presentation_order: 15, display_label: 'Aplicações Financeiras de Liquidez Imediata', normal_balance: 'debit', presentation_sign: 'positive', dfc_treatment: 'cash', active: true },
  ativo_circulante_receber:          { canonical_key: 'ativo_circulante_receber',        statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: AC,  presentation_order: 20, display_label: 'Contas a Receber',                 normal_balance: 'debit',  presentation_sign: 'positive', dfc_treatment: 'operating_asset',         active: true },
  ativo_circulante_estoques:         { canonical_key: 'ativo_circulante_estoques',       statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: AC,  presentation_order: 30, display_label: 'Estoques',                         normal_balance: 'debit',  presentation_sign: 'positive', dfc_treatment: 'operating_asset',         active: true },
  ativo_circulante_impostos:         { canonical_key: 'ativo_circulante_impostos',       statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: AC,  presentation_order: 40, display_label: 'Impostos a Recuperar',             normal_balance: 'debit',  presentation_sign: 'positive', dfc_treatment: 'operating_asset',         active: true },
  ativo_circulante_biologicos:       { canonical_key: 'ativo_circulante_biologicos',     statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: AC,  presentation_order: 50, display_label: 'Ativos Biológicos',                normal_balance: 'debit',  presentation_sign: 'positive', dfc_treatment: 'operating_asset',         active: true },
  ativo_circulante_outros:           { canonical_key: 'ativo_circulante_outros',         statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: AC,  presentation_order: 60, display_label: 'Outros Créditos',                  normal_balance: 'debit',  presentation_sign: 'positive', dfc_treatment: 'operating_asset',         active: true },
  // BP Ativo NC (9) — ativo_nao_circulante é a chave histórica para "Imobilizado" (PERMANECE ATIVA)
  ativo_nc_aplicacoes:               { canonical_key: 'ativo_nc_aplicacoes',             statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: ANC, presentation_order: 10, display_label: 'Aplicações Financeiras',           normal_balance: 'debit',  presentation_sign: 'positive', dfc_treatment: 'requires_review',         active: true },
  ativo_nc_receber_lp:               { canonical_key: 'ativo_nc_receber_lp',             statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: ANC, presentation_order: 20, display_label: 'Contas a Receber LP',              normal_balance: 'debit',  presentation_sign: 'positive', dfc_treatment: 'requires_review',         active: true },
  ativo_nc_impostos_lp:              { canonical_key: 'ativo_nc_impostos_lp',            statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: ANC, presentation_order: 30, display_label: 'Impostos a Recuperar LP',          normal_balance: 'debit',  presentation_sign: 'positive', dfc_treatment: 'requires_review',         active: true },
  ativo_nc_impostos_diferidos:       { canonical_key: 'ativo_nc_impostos_diferidos',     statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: ANC, presentation_order: 40, display_label: 'Impostos Diferidos',               normal_balance: 'debit',  presentation_sign: 'positive', dfc_treatment: 'requires_review',         active: true },
  ativo_nc_outros_creditos:          { canonical_key: 'ativo_nc_outros_creditos',        statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: ANC, presentation_order: 50, display_label: 'Outros Créditos LP',               normal_balance: 'debit',  presentation_sign: 'positive', dfc_treatment: 'requires_review',         active: true },
  ativo_nc_investimentos:            { canonical_key: 'ativo_nc_investimentos',          statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: ANC, presentation_order: 60, display_label: 'Investimentos',                    normal_balance: 'debit',  presentation_sign: 'positive', dfc_treatment: 'investing',               active: true },
  ativo_nc_direitos_uso:             { canonical_key: 'ativo_nc_direitos_uso',           statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: ANC, presentation_order: 70, display_label: 'Direitos de Uso',                  normal_balance: 'debit',  presentation_sign: 'positive', dfc_treatment: 'investing',               active: true },
  ativo_nao_circulante:              { canonical_key: 'ativo_nao_circulante',            statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: ANC, presentation_order: 80, display_label: 'Imobilizado',                      normal_balance: 'debit',  presentation_sign: 'positive', dfc_treatment: 'investing',               active: true },
  ativo_nc_intangivel:               { canonical_key: 'ativo_nc_intangivel',             statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: ANC, presentation_order: 90, display_label: 'Intangível',                       normal_balance: 'debit',  presentation_sign: 'positive', dfc_treatment: 'investing',               active: true },
  // BP Passivo Circulante (8)
  passivo_circulante_trabalhistas:   { canonical_key: 'passivo_circulante_trabalhistas', statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: PC,  presentation_order: 10, display_label: 'Obrigações Trabalhistas',          normal_balance: 'credit', presentation_sign: 'positive', dfc_treatment: 'operating_liability',     active: true },
  passivo_circulante_fiscais:        { canonical_key: 'passivo_circulante_fiscais',      statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: PC,  presentation_order: 20, display_label: 'Obrigações Fiscais',               normal_balance: 'credit', presentation_sign: 'positive', dfc_treatment: 'operating_liability',     active: true },
  passivo_circulante_fornecedores:   { canonical_key: 'passivo_circulante_fornecedores', statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: PC,  presentation_order: 30, display_label: 'Fornecedores',                    normal_balance: 'credit', presentation_sign: 'positive', dfc_treatment: 'operating_liability',     active: true },
  passivo_circulante_emprestimos:    { canonical_key: 'passivo_circulante_emprestimos',  statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: PC,  presentation_order: 40, display_label: 'Empréstimos e Financiamentos',     normal_balance: 'credit', presentation_sign: 'positive', dfc_treatment: 'financing',               active: true },
  passivo_circulante_imoveis:        { canonical_key: 'passivo_circulante_imoveis',      statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: PC,  presentation_order: 50, display_label: 'Obrig. por Aquisição de Imóveis',  normal_balance: 'credit', presentation_sign: 'positive', dfc_treatment: 'requires_review',         active: true },
  passivo_circulante_arrendamentos:  { canonical_key: 'passivo_circulante_arrendamentos',statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: PC,  presentation_order: 60, display_label: 'Arrendamentos a Pagar',            normal_balance: 'credit', presentation_sign: 'positive', dfc_treatment: 'financing',               active: true },
  passivo_circulante_adiantamentos:  { canonical_key: 'passivo_circulante_adiantamentos',statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: PC,  presentation_order: 70, display_label: 'Adiantamentos de Clientes',        normal_balance: 'credit', presentation_sign: 'positive', dfc_treatment: 'operating_liability',     active: true },
  passivo_circulante_outros:         { canonical_key: 'passivo_circulante_outros',       statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: PC,  presentation_order: 80, display_label: 'Outras Contas a Pagar',            normal_balance: 'credit', presentation_sign: 'positive', dfc_treatment: 'operating_liability',     active: true },
  // BP Passivo NC (3)
  passivo_nao_circulante:            { canonical_key: 'passivo_nao_circulante',          statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: PNC, presentation_order: 10, display_label: 'Empréstimos e Financiamentos LP',  normal_balance: 'credit', presentation_sign: 'positive', dfc_treatment: 'financing',               active: true },
  passivo_nc_imoveis_lp:             { canonical_key: 'passivo_nc_imoveis_lp',           statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: PNC, presentation_order: 20, display_label: 'Obrig. por Aquisição de Imóveis LP',normal_balance: 'credit', presentation_sign: 'positive', dfc_treatment: 'requires_review',         active: true },
  passivo_nc_arrendamentos_lp:       { canonical_key: 'passivo_nc_arrendamentos_lp',    statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: PNC, presentation_order: 30, display_label: 'Arrendamentos a Pagar LP',         normal_balance: 'credit', presentation_sign: 'positive', dfc_treatment: 'financing',               active: true },
  // BP Patrimônio Líquido (5)
  patrimonio_capital:                { canonical_key: 'patrimonio_capital',              statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: PL,  presentation_order: 10, display_label: 'Capital Social',                   normal_balance: 'credit', presentation_sign: 'positive', dfc_treatment: 'financing',               active: true },
  patrimonio_reservas:               { canonical_key: 'patrimonio_reservas',             statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: PL,  presentation_order: 20, display_label: 'Reservas',                         normal_balance: 'credit', presentation_sign: 'positive', dfc_treatment: 'requires_review',         active: true },
  patrimonio_reservas_fiscais:       { canonical_key: 'patrimonio_reservas_fiscais',     statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: PL,  presentation_order: 30, display_label: 'Reserva de Incentivos Fiscais',    normal_balance: 'credit', presentation_sign: 'positive', dfc_treatment: 'requires_review',         active: true },
  patrimonio_liquido:                { canonical_key: 'patrimonio_liquido',              statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: PL,  presentation_order: 40, display_label: 'Lucros Acumulados',                normal_balance: 'credit', presentation_sign: 'positive', dfc_treatment: 'ignored',                 active: true },
  patrimonio_prejuizos:              { canonical_key: 'patrimonio_prejuizos',            statement_code: 'BP', line_type: 'source', family: 'balance_sheet', presentation_group: PL,  presentation_order: 50, display_label: 'Prejuízos Acumulados',             normal_balance: 'debit',  presentation_sign: 'negative', dfc_treatment: 'ignored',                 active: true },
  // DRE Receita (3)
  receita_bruta:                     { canonical_key: 'receita_bruta',                   statement_code: 'DRE', line_type: 'source', family: 'dre', presentation_group: DRE_REC,   presentation_order: 10, display_label: 'Receita Bruta',                              normal_balance: 'credit', presentation_sign: 'positive', dfc_treatment: 'indirect_result_component', active: true },
  deducoes_tributarias:              { canonical_key: 'deducoes_tributarias',            statement_code: 'DRE', line_type: 'source', family: 'dre', presentation_group: DRE_REC,   presentation_order: 20, display_label: '(-) Deduções Tributárias',                    normal_balance: 'debit',  presentation_sign: 'negative', dfc_treatment: 'indirect_result_component', active: true },
  devolucoes_abatimentos:            { canonical_key: 'devolucoes_abatimentos',          statement_code: 'DRE', line_type: 'source', family: 'dre', presentation_group: DRE_REC,   presentation_order: 30, display_label: '(-) Devoluções e Abatimentos',                normal_balance: 'debit',  presentation_sign: 'negative', dfc_treatment: 'indirect_result_component', active: true },
  // DRE Custo (1)
  custo_produtos:                    { canonical_key: 'custo_produtos',                  statement_code: 'DRE', line_type: 'source', family: 'dre', presentation_group: DRE_CUSTO, presentation_order: 10, display_label: '(-) Custo',                                   normal_balance: 'debit',  presentation_sign: 'negative', dfc_treatment: 'indirect_result_component', active: true },
  // DRE Despesas Operacionais (3)
  despesas_gerais_admin:             { canonical_key: 'despesas_gerais_admin',           statement_code: 'DRE', line_type: 'source', family: 'dre', presentation_group: DRE_DESP,  presentation_order: 10, display_label: '(-) Gerais e Administrativas',                normal_balance: 'debit',  presentation_sign: 'negative', dfc_treatment: 'indirect_result_component', active: true },
  despesas_comerciais:               { canonical_key: 'despesas_comerciais',             statement_code: 'DRE', line_type: 'source', family: 'dre', presentation_group: DRE_DESP,  presentation_order: 20, display_label: '(-) Comerciais',                              normal_balance: 'debit',  presentation_sign: 'negative', dfc_treatment: 'indirect_result_component', active: true },
  outras_receitas_despesas:          { canonical_key: 'outras_receitas_despesas',        statement_code: 'DRE', line_type: 'source', family: 'dre', presentation_group: DRE_DESP,  presentation_order: 30, display_label: '(+/-) Outras Receitas e Despesas',            normal_balance: 'mixed',  presentation_sign: 'formula',  dfc_treatment: 'indirect_result_component', active: true },
  depreciacao_amortizacao:           { canonical_key: 'depreciacao_amortizacao',         statement_code: 'DRE', line_type: 'source', family: 'dre', presentation_group: DRE_DESP,  presentation_order: 40, display_label: '(-) Depreciação e Amortização',                normal_balance: 'debit',  presentation_sign: 'negative', dfc_treatment: 'non_cash_adjustment', active: true },
  // DRE Resultado Financeiro (2)
  receitas_financeiras:              { canonical_key: 'receitas_financeiras',            statement_code: 'DRE', line_type: 'source', family: 'dre', presentation_group: DRE_FIN,   presentation_order: 10, display_label: '(+) Receitas Financeiras',                    normal_balance: 'credit', presentation_sign: 'positive', dfc_treatment: 'indirect_result_component', active: true },
  despesas_financeiras:              { canonical_key: 'despesas_financeiras',            statement_code: 'DRE', line_type: 'source', family: 'dre', presentation_group: DRE_FIN,   presentation_order: 20, display_label: '(-) Despesas Financeiras',                    normal_balance: 'debit',  presentation_sign: 'negative', dfc_treatment: 'indirect_result_component', active: true },
  // DRE Impostos (2)
  ir_csll:                           { canonical_key: 'ir_csll',                         statement_code: 'DRE', line_type: 'source', family: 'dre', presentation_group: DRE_IMP,   presentation_order: 10, display_label: '(-) Imposto de Renda e CSLL — Correntes',     normal_balance: 'debit',  presentation_sign: 'negative', dfc_treatment: 'indirect_result_component', active: true },
  ir_diferido:                       { canonical_key: 'ir_diferido',                     statement_code: 'DRE', line_type: 'source', family: 'dre', presentation_group: DRE_IMP,   presentation_order: 20, display_label: '(-) Imposto de Renda e CSLL — Diferidos',     normal_balance: 'debit',  presentation_sign: 'negative', dfc_treatment: 'indirect_result_component', active: true },
};
for (const rubric of Object.values(STATEMENT_RUBRIC_REGISTRY)) {
  rubric.classification = 'SOURCE_CANONICAL_RUBRIC';
  rubric.elimination_eligible = rubric.active === true;
  if (rubric.normal_balance === 'credit') {
    rubric.debit_presentation_effect = -1;
    rubric.credit_presentation_effect = 1;
  } else if (rubric.normal_balance === 'debit' && rubric.presentation_sign === 'negative') {
    rubric.debit_presentation_effect = -1;
    rubric.credit_presentation_effect = 1;
  } else if (rubric.normal_balance === 'debit' && rubric.presentation_sign === 'positive') {
    rubric.debit_presentation_effect = 1;
    rubric.credit_presentation_effect = -1;
  }
  if (rubric.normal_balance === 'mixed' || rubric.presentation_sign === 'formula') {
    if (rubric.canonical_key === 'outras_receitas_despesas') {
      rubric.journal_effect_rule = 'explicit';
      rubric.debit_presentation_effect = -1;
      rubric.credit_presentation_effect = 1;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CALCULATED_RUBRICS — 9 rubricas com fórmulas estruturadas (operands como dados)
// ═══════════════════════════════════════════════════════════════════════════

const CALCULATED_RUBRICS = {
  receita_liquida: { canonical_key: 'receita_liquida', statement_code: 'DRE', line_type: 'calculated', family: 'dre', presentation_group: 'Receita', presentation_order: 200, display_label: 'Receita Líquida', operands: ['receita_bruta','deducoes_tributarias','devolucoes_abatimentos'], coefficients: [1,1,1], formula_desc: 'Receita Bruta + Deduções + Devoluções', active: true },
  custos: { canonical_key: 'custos', statement_code: 'DRE', line_type: 'calculated', family: 'dre', presentation_group: 'Custo', presentation_order: 190, display_label: 'Custos', operands: ['custo_produtos'], coefficients: [1], formula_desc: 'Custo de mercadorias, produtos e serviços', active: true },
  lucro_bruto: { canonical_key: 'lucro_bruto', statement_code: 'DRE', line_type: 'calculated', family: 'dre', presentation_group: 'Custo', presentation_order: 200, display_label: 'Lucro Bruto', operands: ['receita_liquida','custos'], coefficients: [1,1], formula_desc: 'Receita Líquida + Custos', active: true },
  despesas_operacionais: { canonical_key: 'despesas_operacionais', statement_code: 'DRE', line_type: 'calculated', family: 'dre', presentation_group: 'Despesas operacionais', presentation_order: 190, display_label: 'Despesas Operacionais', operands: ['despesas_gerais_admin','despesas_comerciais','outras_receitas_despesas','depreciacao_amortizacao'], coefficients: [1,1,1,1], formula_desc: 'Soma das despesas operacionais', active: true },
  ebit: { canonical_key: 'ebit', statement_code: 'DRE', line_type: 'calculated', family: 'dre', presentation_group: 'Despesas operacionais', presentation_order: 200, display_label: 'EBIT', operands: ['lucro_bruto','despesas_operacionais'], coefficients: [1,1], formula_desc: 'Lucro Bruto + Despesas Operacionais', active: true },
  ebitda: { canonical_key: 'ebitda', statement_code: 'DRE', line_type: 'calculated', family: 'dre', presentation_group: 'Despesas operacionais', presentation_order: 210, display_label: 'EBITDA', operands: ['ebit','depreciacao_amortizacao'], coefficients: [1,-1], formula_desc: 'EBIT - Depreciação e Amortização', active: true },
  resultado_financeiro: { canonical_key: 'resultado_financeiro', statement_code: 'DRE', line_type: 'calculated', family: 'dre', presentation_group: 'Resultado financeiro', presentation_order: 200, display_label: 'Resultado Financeiro', operands: ['receitas_financeiras','despesas_financeiras'], coefficients: [1,1], formula_desc: 'Receitas Financeiras + Despesas Financeiras', active: true },
  resultado_antes_ir_csll: { canonical_key: 'resultado_antes_ir_csll', statement_code: 'DRE', line_type: 'calculated', family: 'dre', presentation_group: 'Resultado financeiro', presentation_order: 300, display_label: 'Resultado Antes de IR/CSLL', operands: ['ebit','resultado_financeiro'], coefficients: [1,1], formula_desc: 'EBIT + Resultado Financeiro', active: true },
  resultado_liquido: { canonical_key: 'resultado_liquido', statement_code: 'DRE', line_type: 'total', family: 'dre', presentation_group: 'Impostos', presentation_order: 999, display_label: 'Resultado Líquido do Exercício', operands: ['resultado_antes_ir_csll','ir_csll','ir_diferido'], coefficients: [1,1,1], formula_desc: 'Resultado Antes IR/CSLL + IR/CSLL', active: true },
};

const DRE_DERIVED_ALIASES = { resultado_operacional: 'ebit', resultado_financeiro_liquido: 'resultado_financeiro', resultado_antes_ir: 'resultado_antes_ir_csll' };

// ═══════════════════════════════════════════════════════════════════════════
// STATEMENT_TOTALS — 2 totalizadores (component_keys derivados do registry)
// ═══════════════════════════════════════════════════════════════════════════

const ativoKeys = Object.values(STATEMENT_RUBRIC_REGISTRY).filter(r => r.statement_code === 'BP' && (r.presentation_group === AC || r.presentation_group === ANC)).map(r => r.canonical_key);
const passivoPlKeys = Object.values(STATEMENT_RUBRIC_REGISTRY).filter(r => r.statement_code === 'BP' && (r.presentation_group === PC || r.presentation_group === PNC || r.presentation_group === PL)).map(r => r.canonical_key);

const groupKeys = (group) => Object.values(STATEMENT_RUBRIC_REGISTRY).filter(r => r.statement_code === 'BP' && r.presentation_group === group).map(r => r.canonical_key);
const STATEMENT_TOTALS = {
  total_ativo_circulante: { canonical_key: 'total_ativo_circulante', statement_code: 'BP', line_type: 'total', family: 'balance_sheet', display_label: 'Total do Ativo Circulante', component_keys: groupKeys(AC), active: true },
  total_ativo_nao_circulante: { canonical_key: 'total_ativo_nao_circulante', statement_code: 'BP', line_type: 'total', family: 'balance_sheet', display_label: 'Total do Ativo Não Circulante', component_keys: groupKeys(ANC), active: true },
  total_ativo: { canonical_key: 'total_ativo', statement_code: 'BP', line_type: 'total', family: 'balance_sheet', display_label: 'Total do Ativo', component_keys: ativoKeys, active: true },
  total_passivo_circulante: { canonical_key: 'total_passivo_circulante', statement_code: 'BP', line_type: 'total', family: 'balance_sheet', display_label: 'Total do Passivo Circulante', component_keys: groupKeys(PC), active: true },
  total_passivo_nao_circulante: { canonical_key: 'total_passivo_nao_circulante', statement_code: 'BP', line_type: 'total', family: 'balance_sheet', display_label: 'Total do Passivo Não Circulante', component_keys: groupKeys(PNC), active: true },
  total_passivo: { canonical_key: 'total_passivo', statement_code: 'BP', line_type: 'total', family: 'balance_sheet', display_label: 'Total do Passivo', component_keys: [...groupKeys(PC), ...groupKeys(PNC)], active: true },
  total_patrimonio_liquido: { canonical_key: 'total_patrimonio_liquido', statement_code: 'BP', line_type: 'total', family: 'balance_sheet', display_label: 'Total do Patrimônio Líquido', component_keys: groupKeys(PL), active: true },
  total_passivo_patrimonio_liquido: { canonical_key: 'total_passivo_patrimonio_liquido', statement_code: 'BP', line_type: 'total', family: 'balance_sheet', display_label: 'Total Passivo e Patrimônio Líquido', component_keys: passivoPlKeys, active: true },
};

// ═══════════════════════════════════════════════════════════════════════════
// CANONICAL_ALIASES — ~120 aliases (alias_normalizado → canonical_key)
// ═══════════════════════════════════════════════════════════════════════════

const ex = (alias, key, priority = 50) => ({ alias_normalized: alias, canonical_key: key, resolution_type: 'exact', priority, active: true });

const CANONICAL_ALIASES = [
  ex('caixa e equivalentes de caixa','ativo_circulante_caixa',100), ex('caixa e equivalentes','ativo_circulante_caixa',90), ex('disponibilidades','ativo_circulante_caixa',80), ex('caixa','ativo_circulante_caixa',70),
  ex('contas a receber','ativo_circulante_receber',100), ex('clientes','ativo_circulante_receber',90), ex('duplicatas a receber','ativo_circulante_receber',80), ex('titulos a receber','ativo_circulante_receber',80),
  ex('estoques','ativo_circulante_estoques',100), ex('estoque','ativo_circulante_estoques',90),
  ex('ativos biologicos','ativo_circulante_biologicos',100), ex('ativo biologico','ativo_circulante_biologicos',90), ex('ativo biologico circulante','ativo_circulante_biologicos',95), ex('ativos biologicos circulantes','ativo_circulante_biologicos',95), ex('biologicos','ativo_circulante_biologicos',70),
  ex('impostos a recuperar','ativo_circulante_impostos',100), ex('tributos a recuperar','ativo_circulante_impostos',90), ex('creditos tributarios','ativo_circulante_impostos',80),
  ex('outros creditos','ativo_circulante_outros',100), ex('outros ativos circulantes','ativo_circulante_outros',90), ex('outros ativos','ativo_circulante_outros',70), ex('adiantamentos a fornecedores','ativo_circulante_outros',80), ex('adiantamentos a empregados','ativo_circulante_outros',80),
  ex('aplicacoes financeiras','ativo_nc_aplicacoes',100), ex('contas a receber lp','ativo_nc_receber_lp',100), ex('impostos a recuperar lp','ativo_nc_impostos_lp',100),
  ex('impostos diferidos','ativo_nc_impostos_diferidos',100), ex('imposto de renda diferido ativo','ativo_nc_impostos_diferidos',90), ex('ir diferido ativo','ativo_nc_impostos_diferidos',85),
  ex('outros creditos lp','ativo_nc_outros_creditos',100), ex('investimentos','ativo_nc_investimentos',100), ex('participacoes societarias','ativo_nc_investimentos',90),
  ex('direitos de uso','ativo_nc_direitos_uso',100), ex('direito de uso','ativo_nc_direitos_uso',90), ex('arrendamento direito de uso','ativo_nc_direitos_uso',95),
  ex('imobilizado','ativo_nao_circulante',100), ex('ativo imobilizado','ativo_nao_circulante',95), ex('imobilizado liquido','ativo_nao_circulante',90),
  ex('intangivel','ativo_nc_intangivel',100), ex('ativo intangivel','ativo_nc_intangivel',95), ex('ativo nao circulante','ativo_nao_circulante',60),
  ex('obrigacoes trabalhistas','passivo_circulante_trabalhistas',100), ex('salarios e encargos','passivo_circulante_trabalhistas',90), ex('salarios a pagar','passivo_circulante_trabalhistas',95), ex('encargos sociais','passivo_circulante_trabalhistas',85), ex('ferias e 13 salario','passivo_circulante_trabalhistas',90),
  ex('obrigacoes fiscais','passivo_circulante_fiscais',100), ex('obrigacoes tributarias','passivo_circulante_fiscais',95), ex('tributos a pagar','passivo_circulante_fiscais',90), ex('impostos a pagar','passivo_circulante_fiscais',90), ex('imposto de renda a pagar','passivo_circulante_fiscais',85), ex('csll a pagar','passivo_circulante_fiscais',85), ex('pis e cofins a pagar','passivo_circulante_fiscais',85), ex('icms a pagar','passivo_circulante_fiscais',80), ex('iss a pagar','passivo_circulante_fiscais',80),
  ex('fornecedores','passivo_circulante_fornecedores',100), ex('contas a pagar fornecedores','passivo_circulante_fornecedores',95), ex('fornecedores a pagar','passivo_circulante_fornecedores',95), ex('duplicatas a pagar','passivo_circulante_fornecedores',90),
  ex('emprestimos e financiamentos','passivo_circulante_emprestimos',100), ex('emprestimos cp','passivo_circulante_emprestimos',90), ex('financiamentos cp','passivo_circulante_emprestimos',90), ex('emprestimos bancarios','passivo_circulante_emprestimos',85), ex('debentures cp','passivo_circulante_emprestimos',80),
  ex('obrigacoes por aquisicao de imoveis','passivo_circulante_imoveis',100), ex('arrendamentos a pagar','passivo_circulante_arrendamentos',100), ex('arrendamento cp','passivo_circulante_arrendamentos',90), ex('arrendamento mercantil cp','passivo_circulante_arrendamentos',95),
  ex('adiantamentos de clientes','passivo_circulante_adiantamentos',100), ex('receitas diferidas','passivo_circulante_adiantamentos',80),
  { alias_normalized: 'adiantamentos', canonical_key: 'passivo_circulante_adiantamentos', resolution_type: 'suggestion_only', priority: 30, context: { statement_code: 'BP', expected_side: 'credit' }, active: true, requires_context: true },
  ex('outras contas a pagar','passivo_circulante_outros',100), ex('outros passivos circulantes','passivo_circulante_outros',90), ex('outras obrigacoes','passivo_circulante_outros',80), ex('dividendos a pagar','passivo_circulante_outros',85), ex('juros sobre capital proprio','passivo_circulante_outros',85),
  ex('emprestimos e financiamentos nc','passivo_nao_circulante',100), ex('emprestimos lp','passivo_nao_circulante',95), ex('financiamentos lp','passivo_nao_circulante',95), ex('passivo nao circulante','passivo_nao_circulante',80), ex('debentures lp','passivo_nao_circulante',85), ex('emprestimos e financiamentos lp','passivo_nao_circulante',100),
  ex('obrigacoes por aquisicao de imoveis lp','passivo_nc_imoveis_lp',100), ex('arrendamentos a pagar lp','passivo_nc_arrendamentos_lp',100), ex('arrendamento lp','passivo_nc_arrendamentos_lp',90), ex('arrendamento mercantil lp','passivo_nc_arrendamentos_lp',95),
  ex('capital social','patrimonio_capital',100), ex('capital integralizado','patrimonio_capital',95), ex('capital subscrito','patrimonio_capital',95),
  ex('reservas','patrimonio_reservas',100), ex('reserva legal','patrimonio_reservas',95), ex('reserva de lucros','patrimonio_reservas',90), ex('reservas de capital','patrimonio_reservas',90),
  ex('reserva de incentivos fiscais','patrimonio_reservas_fiscais',100), ex('incentivos fiscais','patrimonio_reservas_fiscais',85),
  ex('lucros acumulados','patrimonio_liquido',100), ex('lucros retidos','patrimonio_liquido',90), ex('resultado do exercicio','patrimonio_liquido',85), ex('lucro do exercicio','patrimonio_liquido',85), ex('patrimonio liquido','patrimonio_liquido',70),
  ex('prejuizos acumulados','patrimonio_prejuizos',100), ex('lucros e prejuizos acumulados','patrimonio_prejuizos',90), ex('lucros (prejuizos) acumulados','patrimonio_prejuizos',95), ex('prejuizo do exercicio','patrimonio_prejuizos',85),
  ex('receitas brutas','receita_bruta',100), ex('receita bruta','receita_bruta',100), ex('receita operacional bruta','receita_bruta',95), ex('receitas operacionais brutas','receita_bruta',95), ex('faturamento bruto','receita_bruta',90), ex('faturamento','receita_bruta',80),
  ex('deducoes tributarias','deducoes_tributarias',100), ex('deducoes de receita','deducoes_tributarias',95), ex('impostos sobre vendas','deducoes_tributarias',90), ex('pis cofins','deducoes_tributarias',80), ex('pis e cofins','deducoes_tributarias',85), ex('icms','deducoes_tributarias',70), ex('iss','deducoes_tributarias',70),
  ex('devolucoes e abatimentos','devolucoes_abatimentos',100), ex('devolucoes','devolucoes_abatimentos',90), ex('abatimentos','devolucoes_abatimentos',90),
  ex('custo dos produtos vendidos','custo_produtos',100), ex('custo das mercadorias vendidas','custo_produtos',100), ex('custo dos servicos prestados','custo_produtos',100), ex('cpv','custo_produtos',90), ex('cmv','custo_produtos',90), ex('csp','custo_produtos',90), ex('custos','custo_produtos',80), ex('custo','custo_produtos',75),
  ex('despesas gerais e administrativas','despesas_gerais_admin',100), ex('despesas administrativas','despesas_gerais_admin',95), ex('gerais e administrativas','despesas_gerais_admin',90), ex('g e a','despesas_gerais_admin',85),
  ex('despesas com vendas','despesas_comerciais',100), ex('despesas de vendas','despesas_comerciais',95), ex('comerciais','despesas_comerciais',80), ex('despesas comerciais','despesas_comerciais',95),
  ex('outras receitas e despesas','outras_receitas_despesas',100), ex('outras receitas operacionais','outras_receitas_despesas',95), ex('outras despesas operacionais','outras_receitas_despesas',95),
  ex('receitas financeiras','receitas_financeiras',100), ex('receita financeira','receitas_financeiras',95), ex('despesas financeiras','despesas_financeiras',100), ex('despesa financeira','despesas_financeiras',95), ex('juros pagos','despesas_financeiras',85), ex('encargos financeiros','despesas_financeiras',85),
  ex('imposto de renda','ir_csll',80), ex('ir e csll','ir_csll',100), ex('irpj e csll','ir_csll',100), ex('ir corrente','ir_csll',95), ex('imposto de renda corrente','ir_csll',95), ex('imposto de renda e contribuicao social correntes','ir_csll',100),
  ex('ir diferido','ir_diferido',100), ex('imposto de renda diferido','ir_diferido',100), ex('csll diferida','ir_diferido',95), ex('imposto de renda e contribuicao social diferidos','ir_diferido',100),
];

const LEGACY_CANONICAL_COMPATIBILITY = {}; // vazio — nenhuma chave deprecated confirmada

const FINANCIAL_REGISTRY_VERSION = '3.0.0';

// ═══════════════════════════════════════════════════════════════════════════
// VALIDAÇÃO
// ═══════════════════════════════════════════════════════════════════════════

const CONTEXT_SUFFIXES = ['_consolidado','_consolidated','_parent','_controladora','_combined','_combinado','_individual'];
const TEMPORAL_PATTERN = /_(19|20)\d{2}(\b|_)/;

function validateFinancialRegistry() {
  const errors = [], warnings = [];
  const allKeys = new Set([...Object.keys(STATEMENT_RUBRIC_REGISTRY), ...Object.keys(CALCULATED_RUBRICS), ...Object.keys(STATEMENT_TOTALS)]);

  for (const key of allKeys) {
    for (const suffix of CONTEXT_SUFFIXES) {
      if (key.includes(suffix)) errors.push({ code: 'CONTEXT_SUFFIX_IN_KEY', message: `canonical_key "${key}" contém sufixo de contexto proibido "${suffix}"`, canonical_key: key });
    }
    if (TEMPORAL_PATTERN.test(key)) errors.push({ code: 'TEMPORAL_PATTERN_IN_KEY', message: `canonical_key "${key}" contém padrão temporal`, canonical_key: key });
  }

  for (const alias of CANONICAL_ALIASES) {
    if (!allKeys.has(alias.canonical_key)) errors.push({ code: 'ALIAS_TARGET_NOT_FOUND', message: `alias "${alias.alias_normalized}" → key inexistente "${alias.canonical_key}"`, alias: alias.alias_normalized, canonical_key: alias.canonical_key });
  }

  for (const [key, calc] of Object.entries(CALCULATED_RUBRICS)) {
    for (const op of calc.operands) {
      if (!allKeys.has(op)) errors.push({ code: 'FORMULA_OPERAND_NOT_FOUND', message: `Fórmula de "${key}" → operand inexistente "${op}"`, canonical_key: key, operand: op });
    }
  }

  // Circular dependency
  for (const startKey of Object.keys(CALCULATED_RUBRICS)) {
    const visited = new Set(); let current = startKey;
    while (current) {
      if (visited.has(current)) { errors.push({ code: 'CIRCULAR_FORMULA_DEPENDENCY', message: `Circular em "${startKey}"`, canonical_key: startKey }); break; }
      visited.add(current);
      const calc = CALCULATED_RUBRICS[current];
      const calcOps = calc?.operands?.filter(op => CALCULATED_RUBRICS[op]);
      current = calcOps && calcOps.length > 0 ? calcOps[0] : null;
    }
  }

  for (const [key, total] of Object.entries(STATEMENT_TOTALS)) {
    for (const comp of total.component_keys) {
      if (!STATEMENT_RUBRIC_REGISTRY[comp]) errors.push({ code: 'TOTAL_COMPONENT_NOT_FOUND', message: `Total "${key}" → component inexistente "${comp}"`, canonical_key: key, operand: comp });
    }
  }

  return {
    valid: errors.length === 0, errors, warnings,
    counts: {
      source_rubrics: Object.keys(STATEMENT_RUBRIC_REGISTRY).length,
      calculated_rubrics: Object.keys(CALCULATED_RUBRICS).length,
      statement_totals: Object.keys(STATEMENT_TOTALS).length,
      aliases: CANONICAL_ALIASES.length,
      compatibility_entries: Object.keys(LEGACY_CANONICAL_COMPATIBILITY).length,
      derived_aliases: Object.keys(DRE_DERIVED_ALIASES).length,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HASH
// ═══════════════════════════════════════════════════════════════════════════

function stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

async function computeRegistryHash() {
  const payload = stableStringify({ rubrics: STATEMENT_RUBRIC_REGISTRY, aliases: CANONICAL_ALIASES, compatibility: LEGACY_CANONICAL_COMPATIBILITY, calculated: CALCULATED_RUBRICS, totals: STATEMENT_TOTALS, derived_aliases: DRE_DERIVED_ALIASES });
  const data = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return 'sha256:' + [...new Uint8Array(hashBuffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const { mode } = await req.json().catch(() => ({}));
    const validation = validateFinancialRegistry();
    const hash = await computeRegistryHash();

    // mode='presentation' → apenas metadados para frontend (sem lógica interna)
    // mode='full' → dados completos para backend consumers
    // default → validação + hash + counts (auditoria)
    if (mode === 'presentation') {
      return Response.json({
        version: FINANCIAL_REGISTRY_VERSION, hash,
        presentation: {
          rubrics: Object.fromEntries(Object.entries(STATEMENT_RUBRIC_REGISTRY).map(([k,v]) => [k, { canonical_key: v.canonical_key, statement_code: v.statement_code, line_type: v.line_type, presentation_group: v.presentation_group, presentation_order: v.presentation_order, display_label: v.display_label, dfc_treatment: v.dfc_treatment, active: v.active }])),
          calculated: Object.fromEntries(Object.entries(CALCULATED_RUBRICS).map(([k,v]) => [k, { canonical_key: v.canonical_key, line_type: v.line_type, presentation_group: v.presentation_group, presentation_order: v.presentation_order, display_label: v.display_label, formula_desc: v.formula_desc, operands: v.operands, active: v.active }])),
          totals: Object.fromEntries(Object.entries(STATEMENT_TOTALS).map(([k,v]) => [k, { canonical_key: v.canonical_key, display_label: v.display_label, component_keys: v.component_keys, active: v.active }])),
          alias_count: CANONICAL_ALIASES.length,
        },
      });
    }

    if (mode === 'full') {
      return Response.json({
        version: FINANCIAL_REGISTRY_VERSION, hash,
        rubrics: STATEMENT_RUBRIC_REGISTRY, aliases: CANONICAL_ALIASES,
        calculated: CALCULATED_RUBRICS, totals: STATEMENT_TOTALS,
        compatibility: LEGACY_CANONICAL_COMPATIBILITY, derived_aliases: DRE_DERIVED_ALIASES,
        validation,
      });
    }

    // default: auditoria
    return Response.json({
      valid: validation.valid, version: FINANCIAL_REGISTRY_VERSION, hash,
      generated_at: new Date().toISOString(),
      counts: validation.counts, errors: validation.errors, warnings: validation.warnings,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});