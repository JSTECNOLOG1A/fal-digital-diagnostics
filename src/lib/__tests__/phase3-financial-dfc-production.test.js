import { describe, it, expect, beforeEach } from 'vitest';
import { buildIndirectCashFlow, setCanonicalDfcBucket } from '@/lib/financial/phase3/statementEngine';

const previous = { ativo_circulante_caixa: 100, ativo_circulante_receber: 100, passivo_circulante_fornecedores: 50, ativo_nc_investimentos: 100, passivo_circulante_emprestimos: 100 };
const meta = {
  ativo_circulante_caixa: { rubric_label: 'Caixa', group_label: 'Ativo circulante' },
  ativo_circulante_receber: { rubric_label: 'Contas a receber', group_label: 'Ativo circulante' },
  passivo_circulante_fornecedores: { rubric_label: 'Fornecedores', group_label: 'Passivo circulante' },
  ativo_nc_investimentos: { rubric_label: 'Investimentos', group_label: 'Ativo não circulante' },
  passivo_circulante_emprestimos: { rubric_label: 'Empréstimos', group_label: 'Passivo circulante' },
};
const value = (result, key) => result.lines.find((line) => line.canonical_key === key)?.value;
const run = (current = {}, extra = {}) => buildIndirectCashFlow({
  periods: ['2024', '2025'], bpValuesByPeriod: { 2024: previous, 2025: { ...previous, ...current } },
  bpMetaByCanonicalKey: meta, netIncomeByPeriod: { 2025: extra.netIncome ?? 0 },
  nonCashAdjustmentByPeriod: { 2025: extra.nonCash ?? 0 }, nonCashAdjustmentDetailByPeriod: {},
  manualAdjustmentByPeriod: { 2025: extra.manual ?? {} }, financialDiagnosisId: 'D', financialUploadId: 'U',
  tenantId: 'T', entityCode: 'E', colMetaMap: {}, overrideMap: extra.override ?? new Map(),
});

describe('DFC produtiva gerada do backend', () => {
  beforeEach(() => setCanonicalDfcBucket({ ativo_circulante_caixa: 'cash', ativo_circulante_receber: 'operating_asset', passivo_circulante_fornecedores: 'operating_liability', ativo_nc_investimentos: 'investing', passivo_circulante_emprestimos: 'financing' }));
  it('exige período anterior', () => expect(buildIndirectCashFlow({ periods: ['2025'], financialDiagnosisId: 'D' }).validations[0].code).toBe('DFC_PREVIOUS_PERIOD_REQUIRED'));
  it('aplica sinais de ativos e passivos operacionais', () => { expect(value(run({ ativo_circulante_receber: 120 }), 'dfc_variacao_ativos_operacionais')).toBe(-20); expect(value(run({ ativo_circulante_receber: 80 }), 'dfc_variacao_ativos_operacionais')).toBe(20); expect(value(run({ passivo_circulante_fornecedores: 70 }), 'dfc_variacao_passivos_operacionais')).toBe(20); expect(value(run({ passivo_circulante_fornecedores: 30 }), 'dfc_variacao_passivos_operacionais')).toBe(-20); });
  it('aplica investimento, financiamento e ajuste manual', () => { expect(value(run({ ativo_nc_investimentos: 130 }), 'dfc_caixa_liquido_atividades_investimento')).toBe(-30); expect(value(run({ passivo_circulante_emprestimos: 120 }, { manual: { financing: 5 } }), 'dfc_caixa_liquido_atividades_financiamento')).toBe(25); });
  it('aplica ajuste sem caixa e override', () => { expect(value(run({}, { nonCash: 10 }), 'dfc_ajustes_sem_efeito_caixa')).toBe(10); const override = new Map([['ativo_nc_investimentos', { manual_bucket: 'operating_asset' }]]); expect(value(run({ ativo_nc_investimentos: 120 }, { override }), 'dfc_variacao_ativos_operacionais')).toBe(-20); });
  it('retorna contrato completo e 11 linhas', () => { const result = run(); expect(result.lines).toHaveLength(11); expect(result.compositionLines.length).toBe(5); expect(result.reconciliation).toHaveLength(1); expect(result.formula_version).toBe('FAL-FIN-3.0.0'); expect(result.registry_version).toBe('3.0.0'); });
  it('usa tolerância absoluta de R$ 0,01', () => { const ok = run({ ativo_circulante_caixa: 100.01 }); expect(ok.validations.some((item) => item.code === 'DFC_CASH_VARIATION_MISMATCH')).toBe(false); const blocked = run({ ativo_circulante_caixa: 100.02 }); expect(blocked.validations.some((item) => item.code === 'DFC_CASH_VARIATION_MISMATCH')).toBe(true); });
  it('bloqueia fonte de caixa indisponível', () => { setCanonicalDfcBucket({ ativo_circulante_receber: 'operating_asset' }); const result = buildIndirectCashFlow({ periods: ['2024', '2025'], bpValuesByPeriod: { 2024: { ativo_circulante_receber: 100 }, 2025: { ativo_circulante_receber: 120 } }, bpMetaByCanonicalKey: meta, netIncomeByPeriod: {}, nonCashAdjustmentByPeriod: {}, nonCashAdjustmentDetailByPeriod: {}, financialDiagnosisId: 'D', overrideMap: new Map() }); expect(result.validations.some((item) => item.code === 'DFC_MISSING_CASH_BASE')).toBe(true); });
});