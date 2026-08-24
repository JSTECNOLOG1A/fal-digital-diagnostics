import { REGISTRY_VERSION, FORMULA_VERSION, REGISTRY, SOURCE_RUBRICS, validateRegistry } from './canonicalRegistry.js';
import { buildStatements, validateBalanceSheet } from './statementEngine.js';
import { calculateIndicators } from './indicatorEngine.js';
import { validateEliminations, applyEliminations } from './consolidationEngine.js';
import { calculateJournalPresentationEffect } from './journalEffects.js';

export const PRODUCTION_ENGINE_CONTRACT = Object.freeze({
  registry_version: REGISTRY_VERSION,
  formula_version: FORMULA_VERSION,
  analysis_types: ['individual', 'combined', 'consolidated'],
  source_rubrics: Object.keys(SOURCE_RUBRICS).sort(),
});

export function executeProductionEngine({ source_values = {}, previous_values = null, context = {} }) {
  const registry = validateRegistry(REGISTRY);
  if (!registry.valid) throw new Error('FINANCIAL_REGISTRY_INVALID');
  const statements = buildStatements(source_values);
  const bp = validateBalanceSheet(statements, context);
  const indicators = bp.balanced ? calculateIndicators(statements, previous_values) : [];
  return { registry_version: REGISTRY_VERSION, formula_version: FORMULA_VERSION, statements, bp, indicators };
}

export function validateConsolidationEntry(entry, contract) {
  const errors = [];
  const debit = SOURCE_RUBRICS[entry.debit_canonical_key];
  const credit = SOURCE_RUBRICS[entry.credit_canonical_key];
  if (!debit?.eliminationEligible || !credit?.eliminationEligible) errors.push({ code: 'ELIMINATION_SOURCE_RUBRIC_REQUIRED' });
  if (debit && credit && debit.statement !== credit.statement && !contract?.allow_cross_statement) errors.push({ code: 'ELIMINATION_STATEMENT_MISMATCH' });
  if (!Number.isFinite(Number(entry.amount)) || Number(entry.amount) <= 0) errors.push({ code: 'ELIMINATION_AMOUNT_INVALID' });
  const justification = String(entry.justification ?? entry.rationale ?? '').trim();
  if (!justification) errors.push({ code: 'ELIMINATION_JUSTIFICATION_REQUIRED' });
  if (entry.justification != null && entry.rationale != null && String(entry.justification).trim() !== String(entry.rationale).trim()) errors.push({ code: 'ELIMINATION_JUSTIFICATION_CONFLICT' });
  if (!entry.origin_entity_id || !entry.destination_entity_id || entry.origin_entity_id === entry.destination_entity_id) errors.push({ code: 'ELIMINATION_SAME_ENTITY' });
  try { calculateJournalPresentationEffect({ rubric: debit, side: 'debit', amount: entry.amount }); calculateJournalPresentationEffect({ rubric: credit, side: 'credit', amount: entry.amount }); } catch (error) { errors.push({ code: error.message }); }
  return { valid: errors.length === 0, errors, statement_code: debit?.statement || null };
}

export function prepareProductionSeries({ gross, eliminations, contract }) {
  const structural = validateEliminations(eliminations, contract);
  if (!structural.valid) return { valid: false, errors: structural.errors };
  for (const entry of eliminations) {
    const validation = validateConsolidationEntry(entry, contract);
    if (!validation.valid) return { valid: false, errors: validation.errors };
  }
  const adjusted = applyEliminations(gross, eliminations);
  const result = executeProductionEngine({ source_values: adjusted, context: contract });
  return { valid: result.bp.balanced, adjusted, ...result, errors: result.bp.validation ? [result.bp.validation] : [] };
}