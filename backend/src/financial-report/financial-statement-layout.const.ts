/**
 * Layout canônico de BP/DRE/DFC para o Relatório da Análise — porta literal
 * de src/lib/financialConstants.js (BP_GROUPS/BP_RUBRICS/BP_TOTALS,
 * DRE_GROUPS/DRE_RUBRICS/DRE_FORMULAS/DRE_CALCULATED_AFTER_GROUP) e da lógica
 * de ordenação/estilo de src/components/financial/CashFlowStatementView.jsx
 * (DFC_ORDER/DFC_TOTAL_KEYS/DFC_DARK_KEYS/DFC_HIDE_TOTAL_KEYS).
 *
 * Existe para que o relatório reaproveite EXATAMENTE a mesma estrutura,
 * agrupamento e hierarquia das telas de Demonstrações já em produção — não
 * uma tabela nova com AV/AH, que foi a primeira tentativa e destoava do que
 * o usuário já usa. Qualquer alteração aqui deve ser replicada nos três
 * componentes React acima (e vice-versa) — não há import cross-runtime
 * possível entre frontend (Vite) e backend (Nest) hoje.
 */

export interface StatementGroupDef {
  key: string;
  label: string;
}

export interface StatementRubricDef {
  canonicalKey: string;
  rubricLabel: string;
  group: string;
  displayOrder: number;
}

// ── Balanço Patrimonial ─────────────────────────────────────────────────

export const BP_GROUPS: StatementGroupDef[] = [
  { key: 'Ativo circulante', label: 'Ativo circulante' },
  { key: 'Ativo não circulante', label: 'Ativo não circulante' },
  { key: 'Passivo circulante', label: 'Passivo circulante' },
  { key: 'Passivo não circulante', label: 'Passivo não circulante' },
  { key: 'Patrimônio líquido', label: 'Patrimônio líquido' },
];

export const BP_SIDE_BY_GROUP: Record<string, 'ativo' | 'passivo'> = {
  'Ativo circulante': 'ativo',
  'Ativo não circulante': 'ativo',
  'Passivo circulante': 'passivo',
  'Passivo não circulante': 'passivo',
  'Patrimônio líquido': 'passivo',
};

export const BP_RUBRICS: StatementRubricDef[] = [
  { canonicalKey: 'ativo_circulante_caixa', rubricLabel: 'Caixa e equivalentes de caixa', group: 'Ativo circulante', displayOrder: 10 },
  { canonicalKey: 'ativo_circulante_receber', rubricLabel: 'Contas a receber', group: 'Ativo circulante', displayOrder: 20 },
  { canonicalKey: 'ativo_circulante_estoques', rubricLabel: 'Estoques', group: 'Ativo circulante', displayOrder: 30 },
  { canonicalKey: 'ativo_circulante_impostos', rubricLabel: 'Impostos a recuperar', group: 'Ativo circulante', displayOrder: 40 },
  { canonicalKey: 'ativo_circulante_biologicos', rubricLabel: 'Ativos biológicos', group: 'Ativo circulante', displayOrder: 50 },
  { canonicalKey: 'ativo_biologico', rubricLabel: 'Ativos biológicos', group: 'Ativo circulante', displayOrder: 50 },
  { canonicalKey: 'ativo_circulante_outros', rubricLabel: 'Outros créditos', group: 'Ativo circulante', displayOrder: 60 },

  { canonicalKey: 'ativo_nc_aplicacoes', rubricLabel: 'Aplicações financeiras', group: 'Ativo não circulante', displayOrder: 10 },
  { canonicalKey: 'ativo_nc_receber_lp', rubricLabel: 'Contas a receber LP', group: 'Ativo não circulante', displayOrder: 20 },
  { canonicalKey: 'ativo_nc_impostos_lp', rubricLabel: 'Impostos a recuperar LP', group: 'Ativo não circulante', displayOrder: 30 },
  { canonicalKey: 'ativo_nc_impostos_diferidos', rubricLabel: 'Impostos diferidos', group: 'Ativo não circulante', displayOrder: 40 },
  { canonicalKey: 'ativo_nc_outros_creditos', rubricLabel: 'Outros créditos LP', group: 'Ativo não circulante', displayOrder: 50 },
  { canonicalKey: 'ativo_nc_investimentos', rubricLabel: 'Investimentos', group: 'Ativo não circulante', displayOrder: 60 },
  { canonicalKey: 'ativo_nc_direitos_uso', rubricLabel: 'Direitos de uso', group: 'Ativo não circulante', displayOrder: 70 },
  { canonicalKey: 'ativo_nao_circulante', rubricLabel: 'Imobilizado', group: 'Ativo não circulante', displayOrder: 80 },
  { canonicalKey: 'ativo_nc_intangivel', rubricLabel: 'Intangível', group: 'Ativo não circulante', displayOrder: 90 },

  { canonicalKey: 'passivo_circulante_trabalhistas', rubricLabel: 'Obrigações trabalhistas', group: 'Passivo circulante', displayOrder: 10 },
  { canonicalKey: 'passivo_circulante_fiscais', rubricLabel: 'Obrigações fiscais', group: 'Passivo circulante', displayOrder: 20 },
  { canonicalKey: 'obrigacoes_tributarias', rubricLabel: 'Obrigações tributárias', group: 'Passivo circulante', displayOrder: 22 },
  { canonicalKey: 'passivo_circulante_fornecedores', rubricLabel: 'Fornecedores', group: 'Passivo circulante', displayOrder: 30 },
  { canonicalKey: 'fornecedores', rubricLabel: 'Fornecedores', group: 'Passivo circulante', displayOrder: 32 },
  { canonicalKey: 'passivo_circulante_emprestimos', rubricLabel: 'Empréstimos e financiamentos', group: 'Passivo circulante', displayOrder: 40 },
  { canonicalKey: 'passivo_circulante_imoveis', rubricLabel: 'Obrig. por aquisição de imóveis', group: 'Passivo circulante', displayOrder: 50 },
  { canonicalKey: 'passivo_circulante_arrendamentos', rubricLabel: 'Arrendamentos a pagar', group: 'Passivo circulante', displayOrder: 60 },
  { canonicalKey: 'passivo_circulante_adiantamentos', rubricLabel: 'Adiantamentos de clientes', group: 'Passivo circulante', displayOrder: 70 },
  { canonicalKey: 'passivo_circulante_outros', rubricLabel: 'Outras contas a pagar', group: 'Passivo circulante', displayOrder: 80 },

  { canonicalKey: 'passivo_nao_circulante', rubricLabel: 'Empréstimos e financiamentos LP', group: 'Passivo não circulante', displayOrder: 10 },
  { canonicalKey: 'passivo_nc_imoveis_lp', rubricLabel: 'Obrig. por aquisição de imóveis LP', group: 'Passivo não circulante', displayOrder: 20 },
  { canonicalKey: 'passivo_nc_arrendamentos_lp', rubricLabel: 'Arrendamentos a pagar LP', group: 'Passivo não circulante', displayOrder: 30 },

  { canonicalKey: 'patrimonio_capital', rubricLabel: 'Capital social', group: 'Patrimônio líquido', displayOrder: 10 },
  { canonicalKey: 'patrimonio_reservas', rubricLabel: 'Reservas', group: 'Patrimônio líquido', displayOrder: 20 },
  { canonicalKey: 'patrimonio_reservas_fiscais', rubricLabel: 'Reserva de incentivos fiscais', group: 'Patrimônio líquido', displayOrder: 30 },
  { canonicalKey: 'patrimonio_liquido', rubricLabel: 'Lucros acumulados', group: 'Patrimônio líquido', displayOrder: 40 },
  { canonicalKey: 'patrimonio_prejuizos', rubricLabel: 'Prejuízos acumulados', group: 'Patrimônio líquido', displayOrder: 50 },
  { canonicalKey: 'lucros_(prejuizos)_acumulados', rubricLabel: 'Lucros (prejuízos) acumulados', group: 'Patrimônio líquido', displayOrder: 55 },
  { canonicalKey: 'resultado_do_exercicio', rubricLabel: 'Resultado do exercício', group: 'Patrimônio líquido', displayOrder: 45 },
  { canonicalKey: 'lucro_do_exercicio', rubricLabel: 'Lucro do exercício', group: 'Patrimônio líquido', displayOrder: 45 },
  { canonicalKey: 'prejuizo_do_exercicio', rubricLabel: 'Prejuízo do exercício', group: 'Patrimônio líquido', displayOrder: 55 },
  { canonicalKey: 'custo', rubricLabel: '(-) Custo (reclassificar)', group: 'Patrimônio líquido', displayOrder: 99 },
];

export const BP_TOTALS = {
  ativo: { canonicalKey: 'total_ativo', label: 'Total do ativo' },
  passivo: { canonicalKey: 'total_passivo_pl', label: 'Total passivo e patrimônio líquido' },
};

// ── Demonstração do Resultado ───────────────────────────────────────────

export const DRE_GROUPS: StatementGroupDef[] = [
  { key: 'Receita', label: 'Receita líquida' },
  { key: 'Custo', label: 'Custo' },
  { key: 'Despesas operacionais', label: 'Despesas operacionais' },
  { key: 'Resultado financeiro', label: 'Resultado financeiro' },
  { key: 'Impostos', label: 'Impostos sobre o lucro' },
];

export const DRE_RUBRICS: StatementRubricDef[] = [
  { canonicalKey: 'receita_bruta', rubricLabel: 'Receita bruta', group: 'Receita', displayOrder: 10 },
  { canonicalKey: 'deducoes_tributarias', rubricLabel: '(-) Deduções tributárias', group: 'Receita', displayOrder: 20 },
  { canonicalKey: 'devolucoes_abatimentos', rubricLabel: '(-) Devoluções e abatimentos', group: 'Receita', displayOrder: 30 },
  { canonicalKey: 'custo_produtos', rubricLabel: '(-) Custo', group: 'Custo', displayOrder: 10 },
  { canonicalKey: 'despesas_gerais_admin', rubricLabel: '(-) Gerais e administrativas', group: 'Despesas operacionais', displayOrder: 10 },
  { canonicalKey: 'despesas_comerciais', rubricLabel: '(-) Comerciais', group: 'Despesas operacionais', displayOrder: 20 },
  { canonicalKey: 'outras_receitas_despesas', rubricLabel: '(+/-) Outras receitas e despesas', group: 'Despesas operacionais', displayOrder: 30 },
  { canonicalKey: 'receitas_financeiras', rubricLabel: '(+) Receitas financeiras', group: 'Resultado financeiro', displayOrder: 10 },
  { canonicalKey: 'despesas_financeiras', rubricLabel: '(-) Despesas financeiras', group: 'Resultado financeiro', displayOrder: 20 },
  { canonicalKey: 'ir_csll', rubricLabel: '(-) Imposto de renda e CSLL — correntes', group: 'Impostos', displayOrder: 10 },
  { canonicalKey: 'ir_diferido', rubricLabel: '(-) Imposto de renda e CSLL — diferidos', group: 'Impostos', displayOrder: 20 },
];

export interface StatementCalculatedDef {
  canonicalKey: string;
  rubricLabel: string;
  group: string;
  lineType: 'calculated' | 'total';
}

export const DRE_FORMULAS: StatementCalculatedDef[] = [
  { canonicalKey: 'receita_liquida', rubricLabel: 'Receita líquida', group: 'Receita', lineType: 'calculated' },
  { canonicalKey: 'lucro_bruto', rubricLabel: 'Lucro bruto', group: 'Custo', lineType: 'calculated' },
  { canonicalKey: 'resultado_operacional', rubricLabel: 'Resultado operacional', group: 'Despesas operacionais', lineType: 'calculated' },
  { canonicalKey: 'resultado_financeiro_liquido', rubricLabel: 'Resultado financeiro líquido', group: 'Resultado financeiro', lineType: 'calculated' },
  { canonicalKey: 'resultado_antes_ir', rubricLabel: 'Resultado antes dos impostos sobre o lucro', group: 'Resultado financeiro', lineType: 'calculated' },
  { canonicalKey: 'resultado_liquido', rubricLabel: 'Resultado líquido do exercício', group: 'Impostos', lineType: 'total' },
];

// group -> canonicalKeys dos totalizadores que aparecem logo após o grupo (na ordem)
export const DRE_CALCULATED_AFTER_GROUP: Record<string, string[]> = {
  Receita: ['receita_liquida'],
  Custo: ['lucro_bruto'],
  'Despesas operacionais': ['resultado_operacional'],
  'Resultado financeiro': ['resultado_financeiro_liquido', 'resultado_antes_ir'],
  Impostos: ['resultado_liquido'],
};

// ── Demonstração dos Fluxos de Caixa ────────────────────────────────────

export const DFC_ORDER: string[] = [
  'dfc_resultado_liquido',
  'dfc_ajustes_nao_caixa',
  'dfc_variacao_ativos_operacionais',
  'dfc_variacao_passivos_operacionais',
  'dfc_caixa_liquido_atividades_operacionais',
  'dfc_caixa_liquido_atividades_investimento',
  'dfc_caixa_liquido_atividades_financiamento',
  'dfc_variacao_liquida_caixa',
  'dfc_saldo_inicial_caixa',
  'dfc_saldo_final_caixa',
  'dfc_movimentacoes_nao_identificadas',
  'dfc_diferenca_validacao',
];

/**
 * Linha divulgada (não somada a nenhuma atividade de caixa — ver
 * buildDfc()/financial-statements.service.ts) para contas de PL/BP sem
 * bucket de caixa. Quando não-zero, precisa de classificação manual antes
 * da versão definitiva do relatório — sinalizada visualmente em
 * financial-report-html.service.ts, não escondida como uma linha comum.
 */
export const DFC_UNIDENTIFIED_KEY = 'dfc_movimentacoes_nao_identificadas';

export const DFC_TOTAL_KEYS = new Set([
  'dfc_caixa_liquido_atividades_operacionais',
  'dfc_caixa_liquido_atividades_investimento',
  'dfc_caixa_liquido_atividades_financiamento',
]);

export const DFC_DARK_KEYS = new Set(['dfc_saldo_final_caixa']);

export const DFC_HIDE_VALUE_KEYS = new Set([
  'dfc_variacao_ativos_operacionais',
  'dfc_variacao_passivos_operacionais',
]);

export const DFC_LABEL_OVERRIDE: Record<string, string> = {
  dfc_saldo_final_caixa: 'Saldo final de caixa e equivalentes',
};
