import { CALCULATED_RUBRICS, SOURCE_RUBRICS, STATEMENT_TOTALS } from './canonicalRegistry.js';

export const MONEY_TOLERANCE = 0.01;
export function optionalNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
export function sumRequiredSources(values, keys) {
  const resolved = keys.map((key) => optionalNumber(values[key]));
  if (resolved.every((value) => value === null)) return null;
  return resolved.reduce((sum, value) => sum + (value ?? 0), 0);
}
const finite = (value) => optionalNumber(value) ?? 0;
const evaluateTerms = (values, terms) => {
  const resolved = terms.map(([key, coefficient]) => {
    const value = optionalNumber(values[key]);
    return value === null ? null : value * coefficient;
  });
  if (resolved.every((value) => value === null)) return null;
  return resolved.reduce((sum, value) => sum + (value ?? 0), 0);
};

export function buildStatements(sourceValues = {}) {
  const values = {};
  for (const key of Object.keys(SOURCE_RUBRICS)) values[key] = optionalNumber(sourceValues[key]);
  for (const [key, meta] of Object.entries(CALCULATED_RUBRICS)) values[key] = evaluateTerms(values, meta.terms);
  for (const [key, meta] of Object.entries(STATEMENT_TOTALS)) values[key] = evaluateTerms(values, meta.terms);
  values.total_passivo_pl = values.total_passivo_patrimonio_liquido;
  values.resultado_operacional = values.ebit;
  values.resultado_financeiro_liquido = values.resultado_financeiro;
  values.resultado_antes_ir = values.resultado_antes_ir_csll;
  return values;
}

export function validateBalanceSheet(values, context = {}) {
  const rawExpected = values.total_ativo;
  const rawActual = values.total_passivo_patrimonio_liquido ?? values.total_passivo_pl;
  const expected = optionalNumber(rawExpected);
  const actual = optionalNumber(rawActual);
  const sourceUnavailable = rawExpected === null || rawExpected === undefined || rawExpected === '' || rawActual === null || rawActual === undefined || rawActual === '';
  const nonFinite = !sourceUnavailable && (expected === null || actual === null);
  const difference = expected === null || actual === null ? null : Math.round(Math.abs(expected - actual) * 100) / 100;
  const balanced = !sourceUnavailable && !nonFinite && difference <= MONEY_TOLERANCE;
  const code = sourceUnavailable ? 'BP_SOURCE_UNAVAILABLE' : nonFinite ? 'BP_NON_FINITE_TOTAL' : balanced ? null : 'BP_ACCOUNTING_EQUATION_MISMATCH';
  const money = (value) => Number.isFinite(value) ? value.toFixed(2) : 'indisponível';
  return { ...context, expected, actual, difference, balanced, validation: balanced ? null : { severity:'blocking', blocking:true, category:'balancete', code, title:'Equação contábil do BP inválida', message:`Ativo ${money(expected)} difere de Passivo + PL ${money(actual)} em ${money(difference)}.` } };
}

export function reconcileNetIncomeToEquity({ previousEquity, currentEquity, netIncome, dividends = 0, contributions = 0, reserves = 0, priorPeriodAdjustments = 0, otherComprehensiveIncome = 0 }) {
  const explainedMovement = finite(netIncome) - finite(dividends) + finite(contributions) + finite(reserves) + finite(priorPeriodAdjustments) + finite(otherComprehensiveIncome);
  const actualMovement = finite(currentEquity) - finite(previousEquity);
  const difference = actualMovement - explainedMovement;
  return { actualMovement, explainedMovement, difference, reconciled: Math.abs(difference) <= MONEY_TOLERANCE };
}

export function assertUniqueFinancialLines(lines) {
  const seen = new Set();
  const duplicates = [];
  for (const line of lines) {
    const key = [line.financial_diagnosis_id, line.canonical_key, line.period, line.dataset_scope, line.entity_code, line.reporting_entity_id, line.financial_upload_id || line.preparation_run_id].join('|');
    if (seen.has(key)) duplicates.push(key); else seen.add(key);
  }
  return { valid: duplicates.length === 0, duplicates };
}

export { buildIndirectCashFlow, setCanonicalDfcBucket } from './generatedDfcEngine.js';