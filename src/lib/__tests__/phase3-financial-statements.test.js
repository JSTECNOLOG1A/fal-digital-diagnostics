import { describe, expect, it } from 'vitest';
import { assertUniqueFinancialLines, buildStatements, reconcileNetIncomeToEquity, validateBalanceSheet } from '@/lib/financial/phase3/statementEngine';

const balanced = { ativo_circulante_caixa:100, ativo_circulante_receber:200, ativo_circulante_estoques:200, ativo_nc_investimentos:300, ativo_nao_circulante:400, passivo_circulante_fornecedores:250, passivo_circulante_emprestimos:350, patrimonio_capital:600, receita_bruta:800, deducoes_tributarias:-80, custo_produtos:-500, despesas_gerais_admin:-60, depreciacao_amortizacao:-20, receitas_financeiras:10, despesas_financeiras:-30, ir_csll:-24 };

describe('F3 BP e DRE — matemática executável', () => {
  it('calcula oito totais mínimos e equilibra o BP', () => { const v=buildStatements(balanced); expect(v.total_ativo).toBe(1200); expect(v.total_passivo).toBe(600); expect(v.total_patrimonio_liquido).toBe(600); expect(v.total_passivo_patrimonio_liquido).toBe(1200); expect(validateBalanceSheet(v).balanced).toBe(true); });
  it('aceita diferença exatamente de R$ 0,01', () => expect(validateBalanceSheet({total_ativo:100,total_passivo_patrimonio_liquido:99.99}).balanced).toBe(true));
  it('bloqueia diferença de R$ 0,02', () => { const r=validateBalanceSheet({total_ativo:100,total_passivo_patrimonio_liquido:99.98}); expect(r.balanced).toBe(false); expect(r.validation.code).toBe('BP_ACCOUNTING_EQUATION_MISMATCH'); expect(r.validation.severity).toBe('blocking'); });
  it('preserva PL negativo em sinal econômico', () => { const v=buildStatements({...balanced,patrimonio_capital:0,patrimonio_prejuizos:-50}); expect(v.total_patrimonio_liquido).toBe(-50); });
  it('calcula receita líquida com dedução e devolução', () => { const v=buildStatements({...balanced,devolucoes_abatimentos:-20}); expect(v.receita_liquida).toBe(700); });
  it('calcula EBIT, EBITDA e resultado líquido sem anualização', () => { const v=buildStatements(balanced); expect(v.lucro_bruto).toBe(220); expect(v.ebit).toBe(140); expect(v.ebitda).toBe(160); expect(v.resultado_financeiro).toBe(-20); expect(v.resultado_liquido).toBe(96); });
  it('reconcilia PL com dividendos e aportes explicados', () => expect(reconcileNetIncomeToEquity({previousEquity:500,currentEquity:600,netIncome:120,dividends:40,contributions:20}).reconciled).toBe(true));
  it('identifica diferença não explicada no bridge do PL', () => expect(reconcileNetIncomeToEquity({previousEquity:500,currentEquity:610,netIncome:100}).difference).toBe(10));
  it('impede duplicidade lógica por scope', () => { const line={financial_diagnosis_id:'d',canonical_key:'caixa',period:'2025',dataset_scope:'individual',entity_code:'A',reporting_entity_id:'A',financial_upload_id:'u'}; expect(assertUniqueFinancialLines([line,{...line}]).valid).toBe(false); });
});