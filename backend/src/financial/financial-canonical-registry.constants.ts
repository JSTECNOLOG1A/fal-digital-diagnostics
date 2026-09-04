/**
 * Registro canônico financeiro — porta de getFinancialCanonicalRegistry
 * (função serverless Base44). No original isso é montado em memória a cada
 * chamada (nenhuma tabela do Base44 guarda essa lista — é puro código),
 * então aqui vira uma constante estática de módulo em vez de uma tabela
 * Postgres: não muda em runtime, ganha checagem de tipo do TypeScript, e
 * elimina a dependência de rede que o original tinha (`invoke(...)` a cada
 * build, com 503 se indisponível).
 *
 * Dados transcritos 1:1 do Base44 (base44/functions/getFinancialCanonicalRegistry/entry.ts):
 * 44 rubricas-fonte, 9 rubricas calculadas (fórmulas), 8 totalizadores de BP,
 * ~140 aliases de texto→rubrica canônica.
 */

export const FINANCIAL_REGISTRY_VERSION = '3.0.0';
export const FINANCIAL_FORMULA_VERSION = 'FAL-FIN-3.0.0';

export type DfcTreatment =
  | 'cash'
  | 'operating_asset'
  | 'operating_liability'
  | 'investing'
  | 'financing'
  | 'non_cash_adjustment'
  | 'indirect_result_component'
  | 'ignored'
  | 'not_applicable'
  | 'requires_review';

export interface SourceRubric {
  canonicalKey: string;
  statementCode: 'BP' | 'DRE';
  lineType: 'source';
  family: 'balance_sheet' | 'dre';
  presentationGroup: string;
  presentationOrder: number;
  displayLabel: string;
  normalBalance: 'debit' | 'credit' | 'mixed';
  presentationSign: 'positive' | 'negative' | 'formula';
  dfcTreatment: DfcTreatment;
  active: true;
  // Derivados no carregamento do módulo (equivalente ao loop de pós-processamento do original)
  debitPresentationEffect: 1 | -1;
  creditPresentationEffect: 1 | -1;
}

export interface CalculatedRubric {
  canonicalKey: string;
  statementCode: 'DRE';
  lineType: 'calculated' | 'total';
  family: 'dre';
  presentationGroup: string;
  presentationOrder: number;
  displayLabel: string;
  operands: string[];
  coefficients: number[];
  formulaDesc: string;
  active: true;
}

export interface TotalRubric {
  canonicalKey: string;
  statementCode: 'BP';
  lineType: 'total';
  family: 'balance_sheet';
  displayLabel: string;
  componentKeys: string[];
  active: true;
}

export interface AliasEntry {
  aliasNormalized: string;
  canonicalKey: string;
  resolutionType: 'exact' | 'suggestion_only';
  priority: number;
  active: true;
  requiresContext?: boolean;
  context?: { statementCode?: string; expectedSide?: string };
}

// ── 2a. STATEMENT_RUBRIC_REGISTRY — 44 rubricas-fonte ─────────────────────

type RawSourceRubric = Omit<SourceRubric, 'debitPresentationEffect' | 'creditPresentationEffect'>;

const RAW_SOURCE_RUBRICS: RawSourceRubric[] = [
  // BP — Ativo Circulante (AC)
  { canonicalKey: 'ativo_circulante_caixa', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'AC', presentationOrder: 10, displayLabel: 'Caixa e equivalentes de caixa', normalBalance: 'debit', presentationSign: 'positive', dfcTreatment: 'cash', active: true },
  { canonicalKey: 'ativo_circulante_aplicacoes_liquidez_imediata', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'AC', presentationOrder: 15, displayLabel: 'Aplicações financeiras de liquidez imediata', normalBalance: 'debit', presentationSign: 'positive', dfcTreatment: 'cash', active: true },
  { canonicalKey: 'ativo_circulante_receber', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'AC', presentationOrder: 20, displayLabel: 'Contas a receber', normalBalance: 'debit', presentationSign: 'positive', dfcTreatment: 'operating_asset', active: true },
  { canonicalKey: 'ativo_circulante_estoques', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'AC', presentationOrder: 30, displayLabel: 'Estoques', normalBalance: 'debit', presentationSign: 'positive', dfcTreatment: 'operating_asset', active: true },
  { canonicalKey: 'ativo_circulante_impostos', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'AC', presentationOrder: 40, displayLabel: 'Impostos a recuperar', normalBalance: 'debit', presentationSign: 'positive', dfcTreatment: 'operating_asset', active: true },
  { canonicalKey: 'ativo_circulante_biologicos', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'AC', presentationOrder: 50, displayLabel: 'Ativos biológicos', normalBalance: 'debit', presentationSign: 'positive', dfcTreatment: 'operating_asset', active: true },
  { canonicalKey: 'ativo_circulante_outros', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'AC', presentationOrder: 60, displayLabel: 'Outros créditos', normalBalance: 'debit', presentationSign: 'positive', dfcTreatment: 'operating_asset', active: true },

  // BP — Ativo Não Circulante (ANC)
  { canonicalKey: 'ativo_nc_aplicacoes', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'ANC', presentationOrder: 10, displayLabel: 'Aplicações financeiras', normalBalance: 'debit', presentationSign: 'positive', dfcTreatment: 'requires_review', active: true },
  { canonicalKey: 'ativo_nc_receber_lp', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'ANC', presentationOrder: 20, displayLabel: 'Contas a receber LP', normalBalance: 'debit', presentationSign: 'positive', dfcTreatment: 'requires_review', active: true },
  { canonicalKey: 'ativo_nc_impostos_lp', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'ANC', presentationOrder: 30, displayLabel: 'Impostos a recuperar LP', normalBalance: 'debit', presentationSign: 'positive', dfcTreatment: 'requires_review', active: true },
  { canonicalKey: 'ativo_nc_impostos_diferidos', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'ANC', presentationOrder: 40, displayLabel: 'Impostos diferidos', normalBalance: 'debit', presentationSign: 'positive', dfcTreatment: 'requires_review', active: true },
  { canonicalKey: 'ativo_nc_outros_creditos', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'ANC', presentationOrder: 50, displayLabel: 'Outros créditos LP', normalBalance: 'debit', presentationSign: 'positive', dfcTreatment: 'requires_review', active: true },
  { canonicalKey: 'ativo_nc_investimentos', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'ANC', presentationOrder: 60, displayLabel: 'Investimentos', normalBalance: 'debit', presentationSign: 'positive', dfcTreatment: 'investing', active: true },
  { canonicalKey: 'ativo_nc_direitos_uso', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'ANC', presentationOrder: 70, displayLabel: 'Direitos de uso', normalBalance: 'debit', presentationSign: 'positive', dfcTreatment: 'investing', active: true },
  { canonicalKey: 'ativo_nao_circulante', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'ANC', presentationOrder: 80, displayLabel: 'Imobilizado', normalBalance: 'debit', presentationSign: 'positive', dfcTreatment: 'investing', active: true },
  { canonicalKey: 'ativo_nc_intangivel', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'ANC', presentationOrder: 90, displayLabel: 'Intangível', normalBalance: 'debit', presentationSign: 'positive', dfcTreatment: 'investing', active: true },

  // BP — Passivo Circulante (PC)
  { canonicalKey: 'passivo_circulante_trabalhistas', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'PC', presentationOrder: 10, displayLabel: 'Obrigações trabalhistas', normalBalance: 'credit', presentationSign: 'positive', dfcTreatment: 'operating_liability', active: true },
  { canonicalKey: 'passivo_circulante_fiscais', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'PC', presentationOrder: 20, displayLabel: 'Obrigações fiscais', normalBalance: 'credit', presentationSign: 'positive', dfcTreatment: 'operating_liability', active: true },
  { canonicalKey: 'passivo_circulante_fornecedores', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'PC', presentationOrder: 30, displayLabel: 'Fornecedores', normalBalance: 'credit', presentationSign: 'positive', dfcTreatment: 'operating_liability', active: true },
  { canonicalKey: 'passivo_circulante_emprestimos', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'PC', presentationOrder: 40, displayLabel: 'Empréstimos e financiamentos', normalBalance: 'credit', presentationSign: 'positive', dfcTreatment: 'financing', active: true },
  { canonicalKey: 'passivo_circulante_imoveis', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'PC', presentationOrder: 50, displayLabel: 'Obrig. por aquisição de imóveis', normalBalance: 'credit', presentationSign: 'positive', dfcTreatment: 'requires_review', active: true },
  { canonicalKey: 'passivo_circulante_arrendamentos', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'PC', presentationOrder: 60, displayLabel: 'Arrendamentos a pagar', normalBalance: 'credit', presentationSign: 'positive', dfcTreatment: 'financing', active: true },
  { canonicalKey: 'passivo_circulante_adiantamentos', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'PC', presentationOrder: 70, displayLabel: 'Adiantamentos de clientes', normalBalance: 'credit', presentationSign: 'positive', dfcTreatment: 'operating_liability', active: true },
  { canonicalKey: 'passivo_circulante_outros', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'PC', presentationOrder: 80, displayLabel: 'Outras contas a pagar', normalBalance: 'credit', presentationSign: 'positive', dfcTreatment: 'operating_liability', active: true },

  // BP — Passivo Não Circulante (PNC)
  { canonicalKey: 'passivo_nao_circulante', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'PNC', presentationOrder: 10, displayLabel: 'Empréstimos e financiamentos LP', normalBalance: 'credit', presentationSign: 'positive', dfcTreatment: 'financing', active: true },
  { canonicalKey: 'passivo_nc_imoveis_lp', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'PNC', presentationOrder: 20, displayLabel: 'Obrig. por aquisição de imóveis LP', normalBalance: 'credit', presentationSign: 'positive', dfcTreatment: 'requires_review', active: true },
  { canonicalKey: 'passivo_nc_arrendamentos_lp', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'PNC', presentationOrder: 30, displayLabel: 'Arrendamentos a pagar LP', normalBalance: 'credit', presentationSign: 'positive', dfcTreatment: 'financing', active: true },

  // BP — Patrimônio Líquido (PL)
  { canonicalKey: 'patrimonio_capital', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'PL', presentationOrder: 10, displayLabel: 'Capital social', normalBalance: 'credit', presentationSign: 'positive', dfcTreatment: 'financing', active: true },
  { canonicalKey: 'patrimonio_reservas', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'PL', presentationOrder: 20, displayLabel: 'Reservas', normalBalance: 'credit', presentationSign: 'positive', dfcTreatment: 'requires_review', active: true },
  { canonicalKey: 'patrimonio_reservas_fiscais', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'PL', presentationOrder: 30, displayLabel: 'Reserva de incentivos fiscais', normalBalance: 'credit', presentationSign: 'positive', dfcTreatment: 'requires_review', active: true },
  { canonicalKey: 'patrimonio_liquido', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'PL', presentationOrder: 40, displayLabel: 'Lucros acumulados', normalBalance: 'credit', presentationSign: 'positive', dfcTreatment: 'ignored', active: true },
  { canonicalKey: 'patrimonio_prejuizos', statementCode: 'BP', lineType: 'source', family: 'balance_sheet', presentationGroup: 'PL', presentationOrder: 50, displayLabel: 'Prejuízos acumulados', normalBalance: 'debit', presentationSign: 'negative', dfcTreatment: 'ignored', active: true },

  // DRE — Receita
  { canonicalKey: 'receita_bruta', statementCode: 'DRE', lineType: 'source', family: 'dre', presentationGroup: 'DRE_REC', presentationOrder: 10, displayLabel: 'Receita bruta', normalBalance: 'credit', presentationSign: 'positive', dfcTreatment: 'indirect_result_component', active: true },
  { canonicalKey: 'deducoes_tributarias', statementCode: 'DRE', lineType: 'source', family: 'dre', presentationGroup: 'DRE_REC', presentationOrder: 20, displayLabel: '(-) Deduções tributárias', normalBalance: 'debit', presentationSign: 'negative', dfcTreatment: 'indirect_result_component', active: true },
  { canonicalKey: 'devolucoes_abatimentos', statementCode: 'DRE', lineType: 'source', family: 'dre', presentationGroup: 'DRE_REC', presentationOrder: 30, displayLabel: '(-) Devoluções e abatimentos', normalBalance: 'debit', presentationSign: 'negative', dfcTreatment: 'indirect_result_component', active: true },

  // DRE — Custo
  { canonicalKey: 'custo_produtos', statementCode: 'DRE', lineType: 'source', family: 'dre', presentationGroup: 'DRE_CUSTO', presentationOrder: 10, displayLabel: '(-) Custo', normalBalance: 'debit', presentationSign: 'negative', dfcTreatment: 'indirect_result_component', active: true },

  // DRE — Despesas Operacionais
  { canonicalKey: 'despesas_gerais_admin', statementCode: 'DRE', lineType: 'source', family: 'dre', presentationGroup: 'DRE_DESP', presentationOrder: 10, displayLabel: '(-) Gerais e administrativas', normalBalance: 'debit', presentationSign: 'negative', dfcTreatment: 'indirect_result_component', active: true },
  { canonicalKey: 'despesas_comerciais', statementCode: 'DRE', lineType: 'source', family: 'dre', presentationGroup: 'DRE_DESP', presentationOrder: 20, displayLabel: '(-) Comerciais', normalBalance: 'debit', presentationSign: 'negative', dfcTreatment: 'indirect_result_component', active: true },
  { canonicalKey: 'outras_receitas_despesas', statementCode: 'DRE', lineType: 'source', family: 'dre', presentationGroup: 'DRE_DESP', presentationOrder: 30, displayLabel: '(+/-) Outras receitas e despesas', normalBalance: 'mixed', presentationSign: 'formula', dfcTreatment: 'indirect_result_component', active: true },
  { canonicalKey: 'depreciacao_amortizacao', statementCode: 'DRE', lineType: 'source', family: 'dre', presentationGroup: 'DRE_DESP', presentationOrder: 40, displayLabel: '(-) Depreciação e amortização', normalBalance: 'debit', presentationSign: 'negative', dfcTreatment: 'non_cash_adjustment', active: true },

  // DRE — Resultado Financeiro
  { canonicalKey: 'receitas_financeiras', statementCode: 'DRE', lineType: 'source', family: 'dre', presentationGroup: 'DRE_FIN', presentationOrder: 10, displayLabel: '(+) Receitas financeiras', normalBalance: 'credit', presentationSign: 'positive', dfcTreatment: 'indirect_result_component', active: true },
  { canonicalKey: 'despesas_financeiras', statementCode: 'DRE', lineType: 'source', family: 'dre', presentationGroup: 'DRE_FIN', presentationOrder: 20, displayLabel: '(-) Despesas financeiras', normalBalance: 'debit', presentationSign: 'negative', dfcTreatment: 'indirect_result_component', active: true },

  // DRE — Impostos
  { canonicalKey: 'ir_csll', statementCode: 'DRE', lineType: 'source', family: 'dre', presentationGroup: 'DRE_IMP', presentationOrder: 10, displayLabel: '(-) Imposto de renda e CSLL — correntes', normalBalance: 'debit', presentationSign: 'negative', dfcTreatment: 'indirect_result_component', active: true },
  { canonicalKey: 'ir_diferido', statementCode: 'DRE', lineType: 'source', family: 'dre', presentationGroup: 'DRE_IMP', presentationOrder: 20, displayLabel: '(-) Imposto de renda e CSLL — diferidos', normalBalance: 'debit', presentationSign: 'negative', dfcTreatment: 'indirect_result_component', active: true },
];

/**
 * Regra de sinal ("SIGN_RULES" do comentário original — não é uma estrutura
 * separada no Base44, é derivada por rubrica a partir de normal_balance +
 * presentation_sign). Mantida idêntica aqui.
 */
function deriveSignEffects(r: RawSourceRubric): Pick<SourceRubric, 'debitPresentationEffect' | 'creditPresentationEffect'> {
  if (r.canonicalKey === 'outras_receitas_despesas') {
    return { debitPresentationEffect: -1, creditPresentationEffect: 1 };
  }
  if (r.normalBalance === 'credit') {
    return { debitPresentationEffect: -1, creditPresentationEffect: 1 };
  }
  // normalBalance === 'debit'
  if (r.presentationSign === 'negative') {
    return { debitPresentationEffect: -1, creditPresentationEffect: 1 };
  }
  return { debitPresentationEffect: 1, creditPresentationEffect: -1 };
}

export const STATEMENT_RUBRIC_REGISTRY: Record<string, SourceRubric> = Object.fromEntries(
  RAW_SOURCE_RUBRICS.map((r) => [r.canonicalKey, { ...r, ...deriveSignEffects(r) }]),
);

// ── 2b. CALCULATED_RUBRICS — 9 rubricas de fórmula ────────────────────────

export const CALCULATED_RUBRICS: Record<string, CalculatedRubric> = {
  receita_liquida: {
    canonicalKey: 'receita_liquida', statementCode: 'DRE', lineType: 'calculated', family: 'dre',
    presentationGroup: 'DRE_REC', presentationOrder: 40, displayLabel: 'Receita líquida',
    operands: ['receita_bruta', 'deducoes_tributarias', 'devolucoes_abatimentos'], coefficients: [1, 1, 1],
    formulaDesc: 'Receita Bruta + Deduções + Devoluções', active: true,
  },
  custos: {
    canonicalKey: 'custos', statementCode: 'DRE', lineType: 'calculated', family: 'dre',
    presentationGroup: 'DRE_CUSTO', presentationOrder: 20, displayLabel: 'Custos',
    operands: ['custo_produtos'], coefficients: [1],
    formulaDesc: 'Custo de mercadorias, produtos e serviços', active: true,
  },
  lucro_bruto: {
    canonicalKey: 'lucro_bruto', statementCode: 'DRE', lineType: 'calculated', family: 'dre',
    presentationGroup: 'DRE_CUSTO', presentationOrder: 30, displayLabel: 'Lucro bruto',
    operands: ['receita_liquida', 'custos'], coefficients: [1, 1],
    formulaDesc: 'Receita Líquida + Custos', active: true,
  },
  despesas_operacionais: {
    canonicalKey: 'despesas_operacionais', statementCode: 'DRE', lineType: 'calculated', family: 'dre',
    presentationGroup: 'DRE_DESP', presentationOrder: 50, displayLabel: 'Despesas operacionais',
    operands: ['despesas_gerais_admin', 'despesas_comerciais', 'outras_receitas_despesas', 'depreciacao_amortizacao'],
    coefficients: [1, 1, 1, 1],
    formulaDesc: 'Soma das despesas operacionais', active: true,
  },
  ebit: {
    canonicalKey: 'ebit', statementCode: 'DRE', lineType: 'calculated', family: 'dre',
    presentationGroup: 'DRE_DESP', presentationOrder: 60, displayLabel: 'EBIT',
    operands: ['lucro_bruto', 'despesas_operacionais'], coefficients: [1, 1],
    formulaDesc: 'Lucro Bruto + Despesas Operacionais', active: true,
  },
  ebitda: {
    canonicalKey: 'ebitda', statementCode: 'DRE', lineType: 'calculated', family: 'dre',
    presentationGroup: 'DRE_DESP', presentationOrder: 70, displayLabel: 'EBITDA',
    operands: ['ebit', 'depreciacao_amortizacao'], coefficients: [1, -1],
    formulaDesc: 'EBIT - Depreciação e Amortização', active: true,
  },
  resultado_financeiro: {
    canonicalKey: 'resultado_financeiro', statementCode: 'DRE', lineType: 'calculated', family: 'dre',
    presentationGroup: 'DRE_FIN', presentationOrder: 30, displayLabel: 'Resultado financeiro',
    operands: ['receitas_financeiras', 'despesas_financeiras'], coefficients: [1, 1],
    formulaDesc: 'Receitas Financeiras + Despesas Financeiras', active: true,
  },
  resultado_antes_ir_csll: {
    canonicalKey: 'resultado_antes_ir_csll', statementCode: 'DRE', lineType: 'calculated', family: 'dre',
    presentationGroup: 'DRE_FIN', presentationOrder: 40, displayLabel: 'Resultado antes do IR/CSLL',
    operands: ['ebit', 'resultado_financeiro'], coefficients: [1, 1],
    formulaDesc: 'EBIT + Resultado Financeiro', active: true,
  },
  resultado_liquido: {
    canonicalKey: 'resultado_liquido', statementCode: 'DRE', lineType: 'total', family: 'dre',
    presentationGroup: 'DRE_IMP', presentationOrder: 30, displayLabel: 'Resultado líquido do exercício',
    operands: ['resultado_antes_ir_csll', 'ir_csll', 'ir_diferido'], coefficients: [1, 1, 1],
    formulaDesc: 'Resultado Antes IR/CSLL + IR/CSLL', active: true,
  },
};

/** Aliases legados de nomes de DRE → chave calculada (DRE_DERIVED_ALIASES). */
export const DRE_DERIVED_ALIASES: Record<string, string> = {
  resultado_operacional: 'ebit',
  resultado_financeiro_liquido: 'resultado_financeiro',
  resultado_antes_ir: 'resultado_antes_ir_csll',
};

// ── 2c. STATEMENT_TOTALS — 8 totalizadores de BP ──────────────────────────

function keysInGroup(group: string): string[] {
  return RAW_SOURCE_RUBRICS.filter((r) => r.presentationGroup === group).map((r) => r.canonicalKey);
}

const AC_KEYS = keysInGroup('AC');
const ANC_KEYS = keysInGroup('ANC');
const PC_KEYS = keysInGroup('PC');
const PNC_KEYS = keysInGroup('PNC');
const PL_KEYS = keysInGroup('PL');

export const STATEMENT_TOTALS: Record<string, TotalRubric> = {
  total_ativo_circulante: { canonicalKey: 'total_ativo_circulante', statementCode: 'BP', lineType: 'total', family: 'balance_sheet', displayLabel: 'Total do ativo circulante', componentKeys: AC_KEYS, active: true },
  total_ativo_nao_circulante: { canonicalKey: 'total_ativo_nao_circulante', statementCode: 'BP', lineType: 'total', family: 'balance_sheet', displayLabel: 'Total do ativo não circulante', componentKeys: ANC_KEYS, active: true },
  total_ativo: { canonicalKey: 'total_ativo', statementCode: 'BP', lineType: 'total', family: 'balance_sheet', displayLabel: 'Total do ativo', componentKeys: [...AC_KEYS, ...ANC_KEYS], active: true },
  total_passivo_circulante: { canonicalKey: 'total_passivo_circulante', statementCode: 'BP', lineType: 'total', family: 'balance_sheet', displayLabel: 'Total do passivo circulante', componentKeys: PC_KEYS, active: true },
  total_passivo_nao_circulante: { canonicalKey: 'total_passivo_nao_circulante', statementCode: 'BP', lineType: 'total', family: 'balance_sheet', displayLabel: 'Total do passivo não circulante', componentKeys: PNC_KEYS, active: true },
  total_passivo: { canonicalKey: 'total_passivo', statementCode: 'BP', lineType: 'total', family: 'balance_sheet', displayLabel: 'Total do passivo', componentKeys: [...PC_KEYS, ...PNC_KEYS], active: true },
  total_patrimonio_liquido: { canonicalKey: 'total_patrimonio_liquido', statementCode: 'BP', lineType: 'total', family: 'balance_sheet', displayLabel: 'Total do patrimônio líquido', componentKeys: PL_KEYS, active: true },
  total_passivo_patrimonio_liquido: { canonicalKey: 'total_passivo_patrimonio_liquido', statementCode: 'BP', lineType: 'total', family: 'balance_sheet', displayLabel: 'Total do passivo + patrimônio líquido', componentKeys: [...PC_KEYS, ...PNC_KEYS, ...PL_KEYS], active: true },
};

// ── 2d. CANONICAL_ALIASES — ~140 aliases de texto → chave canônica ────────

function ex(alias: string, canonicalKey: string, priority = 50): AliasEntry {
  return { aliasNormalized: alias, canonicalKey, resolutionType: 'exact', priority, active: true };
}

export const CANONICAL_ALIASES: AliasEntry[] = [
  ex('caixa e equivalentes de caixa', 'ativo_circulante_caixa', 100),
  ex('caixa e equivalentes', 'ativo_circulante_caixa', 90),
  ex('disponibilidades', 'ativo_circulante_caixa', 80),
  ex('caixa', 'ativo_circulante_caixa', 70),

  ex('contas a receber', 'ativo_circulante_receber', 100),
  ex('clientes', 'ativo_circulante_receber', 90),
  ex('duplicatas a receber', 'ativo_circulante_receber', 80),
  ex('titulos a receber', 'ativo_circulante_receber', 80),

  ex('estoques', 'ativo_circulante_estoques', 100),
  ex('estoque', 'ativo_circulante_estoques', 90),

  ex('ativos biologicos', 'ativo_circulante_biologicos', 100),
  ex('ativo biologico', 'ativo_circulante_biologicos', 90),
  ex('ativo biologico circulante', 'ativo_circulante_biologicos', 95),
  ex('ativos biologicos circulantes', 'ativo_circulante_biologicos', 95),
  ex('biologicos', 'ativo_circulante_biologicos', 70),

  ex('impostos a recuperar', 'ativo_circulante_impostos', 100),
  ex('tributos a recuperar', 'ativo_circulante_impostos', 90),
  ex('creditos tributarios', 'ativo_circulante_impostos', 80),

  ex('outros creditos', 'ativo_circulante_outros', 100),
  ex('outros ativos circulantes', 'ativo_circulante_outros', 90),
  ex('outros ativos', 'ativo_circulante_outros', 70),
  ex('adiantamentos a fornecedores', 'ativo_circulante_outros', 80),
  ex('adiantamentos a empregados', 'ativo_circulante_outros', 80),

  ex('aplicacoes financeiras', 'ativo_nc_aplicacoes', 100),
  ex('contas a receber lp', 'ativo_nc_receber_lp', 100),
  ex('impostos a recuperar lp', 'ativo_nc_impostos_lp', 100),

  ex('impostos diferidos', 'ativo_nc_impostos_diferidos', 100),
  ex('imposto de renda diferido ativo', 'ativo_nc_impostos_diferidos', 90),
  ex('ir diferido ativo', 'ativo_nc_impostos_diferidos', 85),

  ex('outros creditos lp', 'ativo_nc_outros_creditos', 100),

  ex('investimentos', 'ativo_nc_investimentos', 100),
  ex('participacoes societarias', 'ativo_nc_investimentos', 90),

  ex('direitos de uso', 'ativo_nc_direitos_uso', 100),
  ex('direito de uso', 'ativo_nc_direitos_uso', 90),
  ex('arrendamento direito de uso', 'ativo_nc_direitos_uso', 95),

  ex('imobilizado', 'ativo_nao_circulante', 100),
  ex('ativo imobilizado', 'ativo_nao_circulante', 95),
  ex('imobilizado liquido', 'ativo_nao_circulante', 90),
  ex('ativo nao circulante', 'ativo_nao_circulante', 60),

  ex('intangivel', 'ativo_nc_intangivel', 100),
  ex('ativo intangivel', 'ativo_nc_intangivel', 95),

  ex('obrigacoes trabalhistas', 'passivo_circulante_trabalhistas', 100),
  ex('salarios e encargos', 'passivo_circulante_trabalhistas', 90),
  ex('salarios a pagar', 'passivo_circulante_trabalhistas', 95),
  ex('encargos sociais', 'passivo_circulante_trabalhistas', 85),
  ex('ferias e 13 salario', 'passivo_circulante_trabalhistas', 90),

  ex('obrigacoes fiscais', 'passivo_circulante_fiscais', 100),
  ex('obrigacoes tributarias', 'passivo_circulante_fiscais', 95),
  ex('tributos a pagar', 'passivo_circulante_fiscais', 90),
  ex('impostos a pagar', 'passivo_circulante_fiscais', 90),
  ex('imposto de renda a pagar', 'passivo_circulante_fiscais', 85),
  ex('csll a pagar', 'passivo_circulante_fiscais', 85),
  ex('pis e cofins a pagar', 'passivo_circulante_fiscais', 85),
  ex('icms a pagar', 'passivo_circulante_fiscais', 80),
  ex('iss a pagar', 'passivo_circulante_fiscais', 80),

  ex('fornecedores', 'passivo_circulante_fornecedores', 100),
  ex('contas a pagar fornecedores', 'passivo_circulante_fornecedores', 95),
  ex('fornecedores a pagar', 'passivo_circulante_fornecedores', 95),
  ex('duplicatas a pagar', 'passivo_circulante_fornecedores', 90),

  ex('emprestimos e financiamentos', 'passivo_circulante_emprestimos', 100),
  ex('emprestimos cp', 'passivo_circulante_emprestimos', 90),
  ex('financiamentos cp', 'passivo_circulante_emprestimos', 90),
  ex('emprestimos bancarios', 'passivo_circulante_emprestimos', 85),
  ex('debentures cp', 'passivo_circulante_emprestimos', 80),

  ex('obrigacoes por aquisicao de imoveis', 'passivo_circulante_imoveis', 100),

  ex('arrendamentos a pagar', 'passivo_circulante_arrendamentos', 100),
  ex('arrendamento cp', 'passivo_circulante_arrendamentos', 90),
  ex('arrendamento mercantil cp', 'passivo_circulante_arrendamentos', 95),

  ex('adiantamentos de clientes', 'passivo_circulante_adiantamentos', 100),
  ex('receitas diferidas', 'passivo_circulante_adiantamentos', 80),
  {
    aliasNormalized: 'adiantamentos', canonicalKey: 'passivo_circulante_adiantamentos',
    resolutionType: 'suggestion_only', priority: 30, active: true,
    requiresContext: true, context: { statementCode: 'BP', expectedSide: 'credit' },
  },

  ex('outras contas a pagar', 'passivo_circulante_outros', 100),
  ex('outros passivos circulantes', 'passivo_circulante_outros', 90),
  ex('outras obrigacoes', 'passivo_circulante_outros', 80),
  ex('dividendos a pagar', 'passivo_circulante_outros', 85),
  ex('juros sobre capital proprio', 'passivo_circulante_outros', 85),

  ex('emprestimos e financiamentos nc', 'passivo_nao_circulante', 100),
  ex('emprestimos lp', 'passivo_nao_circulante', 95),
  ex('financiamentos lp', 'passivo_nao_circulante', 95),
  ex('passivo nao circulante', 'passivo_nao_circulante', 80),
  ex('debentures lp', 'passivo_nao_circulante', 85),
  ex('emprestimos e financiamentos lp', 'passivo_nao_circulante', 100),

  ex('obrigacoes por aquisicao de imoveis lp', 'passivo_nc_imoveis_lp', 100),

  ex('arrendamentos a pagar lp', 'passivo_nc_arrendamentos_lp', 100),
  ex('arrendamento lp', 'passivo_nc_arrendamentos_lp', 90),
  ex('arrendamento mercantil lp', 'passivo_nc_arrendamentos_lp', 95),

  ex('capital social', 'patrimonio_capital', 100),
  ex('capital integralizado', 'patrimonio_capital', 95),
  ex('capital subscrito', 'patrimonio_capital', 95),

  ex('reservas', 'patrimonio_reservas', 100),
  ex('reserva legal', 'patrimonio_reservas', 95),
  ex('reserva de lucros', 'patrimonio_reservas', 90),
  ex('reservas de capital', 'patrimonio_reservas', 90),

  ex('reserva de incentivos fiscais', 'patrimonio_reservas_fiscais', 100),
  ex('incentivos fiscais', 'patrimonio_reservas_fiscais', 85),

  ex('lucros acumulados', 'patrimonio_liquido', 100),
  ex('lucros retidos', 'patrimonio_liquido', 90),
  ex('resultado do exercicio', 'patrimonio_liquido', 85),
  ex('lucro do exercicio', 'patrimonio_liquido', 85),
  ex('patrimonio liquido', 'patrimonio_liquido', 70),

  ex('prejuizos acumulados', 'patrimonio_prejuizos', 100),
  ex('lucros e prejuizos acumulados', 'patrimonio_prejuizos', 90),
  ex('lucros (prejuizos) acumulados', 'patrimonio_prejuizos', 95),
  ex('prejuizo do exercicio', 'patrimonio_prejuizos', 85),

  ex('receitas brutas', 'receita_bruta', 100),
  ex('receita bruta', 'receita_bruta', 100),
  ex('receita operacional bruta', 'receita_bruta', 95),
  ex('receitas operacionais brutas', 'receita_bruta', 95),
  ex('faturamento bruto', 'receita_bruta', 90),
  ex('faturamento', 'receita_bruta', 80),

  ex('deducoes tributarias', 'deducoes_tributarias', 100),
  ex('deducoes de receita', 'deducoes_tributarias', 95),
  ex('impostos sobre vendas', 'deducoes_tributarias', 90),
  ex('pis cofins', 'deducoes_tributarias', 80),
  ex('pis e cofins', 'deducoes_tributarias', 85),
  ex('icms', 'deducoes_tributarias', 70),
  ex('iss', 'deducoes_tributarias', 70),

  ex('devolucoes e abatimentos', 'devolucoes_abatimentos', 100),
  ex('devolucoes', 'devolucoes_abatimentos', 90),
  ex('abatimentos', 'devolucoes_abatimentos', 90),

  ex('custo dos produtos vendidos', 'custo_produtos', 100),
  ex('custo das mercadorias vendidas', 'custo_produtos', 100),
  ex('custo dos servicos prestados', 'custo_produtos', 100),
  ex('cpv', 'custo_produtos', 90),
  ex('cmv', 'custo_produtos', 90),
  ex('csp', 'custo_produtos', 90),
  ex('custos', 'custo_produtos', 80),
  ex('custo', 'custo_produtos', 75),

  ex('despesas gerais e administrativas', 'despesas_gerais_admin', 100),
  ex('despesas administrativas', 'despesas_gerais_admin', 95),
  ex('gerais e administrativas', 'despesas_gerais_admin', 90),
  ex('g e a', 'despesas_gerais_admin', 85),

  ex('despesas com vendas', 'despesas_comerciais', 100),
  ex('despesas de vendas', 'despesas_comerciais', 95),
  ex('comerciais', 'despesas_comerciais', 80),
  ex('despesas comerciais', 'despesas_comerciais', 95),

  ex('outras receitas e despesas', 'outras_receitas_despesas', 100),
  ex('outras receitas operacionais', 'outras_receitas_despesas', 95),
  ex('outras despesas operacionais', 'outras_receitas_despesas', 95),

  ex('receitas financeiras', 'receitas_financeiras', 100),
  ex('receita financeira', 'receitas_financeiras', 95),

  ex('despesas financeiras', 'despesas_financeiras', 100),
  ex('despesa financeira', 'despesas_financeiras', 95),
  ex('juros pagos', 'despesas_financeiras', 85),
  ex('encargos financeiros', 'despesas_financeiras', 85),

  ex('imposto de renda', 'ir_csll', 80),
  ex('ir e csll', 'ir_csll', 100),
  ex('irpj e csll', 'ir_csll', 100),
  ex('ir corrente', 'ir_csll', 95),
  ex('imposto de renda corrente', 'ir_csll', 95),
  ex('imposto de renda e contribuicao social correntes', 'ir_csll', 100),

  ex('ir diferido', 'ir_diferido', 100),
  ex('imposto de renda diferido', 'ir_diferido', 100),
  ex('csll diferida', 'ir_diferido', 95),
  ex('imposto de renda e contribuicao social diferidos', 'ir_diferido', 100),
];

// ── 2e. LEGACY_CANONICAL_COMPATIBILITY — vazio (sem chaves deprecated) ────
export const LEGACY_CANONICAL_COMPATIBILITY: Record<string, string> = {};

// ── Índice de alias já normalizado (lowercase/sem acento) → canonicalKey,
// respeitando prioridade (maior primeiro) e ignorando suggestion_only.
export const ALIAS_TO_CANONICAL: Map<string, string> = new Map(
  [...CANONICAL_ALIASES]
    .filter((a) => a.resolutionType === 'exact' && a.active)
    .sort((a, b) => b.priority - a.priority)
    .map((a) => [a.aliasNormalized, a.canonicalKey] as const),
);

/** Meta consolidado por canonicalKey (rubricas-fonte + calculadas + totais). */
export interface CanonicalMeta {
  group: string;
  label: string;
  statementCode: string;
  lineType: string;
  dfcTreatment?: DfcTreatment;
}

export const CANONICAL_META: Record<string, CanonicalMeta> = {
  ...Object.fromEntries(
    Object.values(STATEMENT_RUBRIC_REGISTRY).map((r) => [
      r.canonicalKey,
      { group: r.presentationGroup, label: r.displayLabel, statementCode: r.statementCode, lineType: r.lineType, dfcTreatment: r.dfcTreatment },
    ]),
  ),
  ...Object.fromEntries(
    Object.values(CALCULATED_RUBRICS).map((r) => [
      r.canonicalKey,
      { group: r.presentationGroup, label: r.displayLabel, statementCode: r.statementCode, lineType: r.lineType },
    ]),
  ),
  ...Object.fromEntries(
    Object.values(STATEMENT_TOTALS).map((r) => [
      r.canonicalKey,
      { group: 'TOTAL', label: r.displayLabel, statementCode: r.statementCode, lineType: r.lineType },
    ]),
  ),
};

export function isAtivoKey(canonicalKey: string): boolean {
  const meta = CANONICAL_META[canonicalKey];
  if (meta?.group) return meta.group === 'AC' || meta.group === 'ANC' || meta.group === 'TOTAL_ATIVO';
  return canonicalKey.startsWith('ativo') || canonicalKey.startsWith('total_ativo');
}

/** Mapa canonicalKey (BP) → balde padrão de DFC (CANONICAL_DFC_BUCKET). */
export const CANONICAL_DFC_BUCKET: Record<string, DfcTreatment> = Object.fromEntries(
  Object.values(STATEMENT_RUBRIC_REGISTRY).map((r) => [r.canonicalKey, r.dfcTreatment]),
);

// ── Validação de integridade do registro (validateFinancialRegistry) ─────

export interface RegistryValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  counts: { rubrics: number; aliases: number; calculated: number; totals: number };
}

export function validateFinancialRegistry(): RegistryValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const allKeys = new Set([
    ...Object.keys(STATEMENT_RUBRIC_REGISTRY),
    ...Object.keys(CALCULATED_RUBRICS),
    ...Object.keys(STATEMENT_TOTALS),
  ]);

  for (const alias of CANONICAL_ALIASES) {
    if (!allKeys.has(alias.canonicalKey)) {
      errors.push(`Alias "${alias.aliasNormalized}" aponta para chave inexistente: ${alias.canonicalKey}`);
    }
  }
  for (const calc of Object.values(CALCULATED_RUBRICS)) {
    for (const op of calc.operands) {
      if (!allKeys.has(op)) {
        errors.push(`Fórmula "${calc.canonicalKey}" referencia operando inexistente: ${op}`);
      }
    }
  }
  for (const total of Object.values(STATEMENT_TOTALS)) {
    for (const k of total.componentKeys) {
      if (!Object.prototype.hasOwnProperty.call(STATEMENT_RUBRIC_REGISTRY, k)) {
        errors.push(`Total "${total.canonicalKey}" referencia componente inexistente: ${k}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    counts: {
      rubrics: Object.keys(STATEMENT_RUBRIC_REGISTRY).length,
      aliases: CANONICAL_ALIASES.length,
      calculated: Object.keys(CALCULATED_RUBRICS).length,
      totals: Object.keys(STATEMENT_TOTALS).length,
    },
  };
}

export const FINANCIAL_REGISTRY_VALIDATION = validateFinancialRegistry();
