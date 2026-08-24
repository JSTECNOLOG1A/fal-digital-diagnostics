import { MONEY_TOLERANCE } from './statementEngine.js';
import { SOURCE_RUBRICS } from './canonicalRegistry.js';
import { applyJournalEntries, calculateJournalPresentationEffect } from './journalEffects.js';

const identity = (entry) => [entry.period, entry.origin_entity_id || entry.source_entity_id, entry.destination_entity_id || entry.counterparty_entity_id, entry.debit_canonical_key, entry.credit_canonical_key, Number(entry.amount)].join('|');
export function validateEliminations(entries, { perimeter, periods, canonicalKeys, analysisType, parentEntityId }) {
  const errors = [], seen = new Set(), perimeterSet = new Set(perimeter), periodSet = new Set(periods), keySet = new Set(canonicalKeys);
  for (const entry of entries) {
    const origin = entry.origin_entity_id || entry.source_entity_id, destination = entry.destination_entity_id || entry.counterparty_entity_id;
    const justification = String(entry.justification ?? entry.rationale ?? '').trim();
    if (origin === destination) errors.push({ code:'ELIMINATION_SAME_ENTITY', entry });
    if (!perimeterSet.has(origin) || !perimeterSet.has(destination)) errors.push({ code:'ELIMINATION_ENTITY_OUTSIDE_PERIMETER', entry });
    if (!periodSet.has(entry.period)) errors.push({ code:'ELIMINATION_PERIOD_NOT_FOUND', entry });
    if (!keySet.has(entry.debit_canonical_key) || !keySet.has(entry.credit_canonical_key)) errors.push({ code:'ELIMINATION_CANONICAL_KEY_INVALID', entry });
    if (!justification) errors.push({ code:'ELIMINATION_JUSTIFICATION_REQUIRED', entry });
    if (analysisType === 'individual' || entry.dataset_scope === 'parent') errors.push({ code:'ELIMINATION_INDIVIDUAL_SCOPE_FORBIDDEN', entry });
    try { calculateJournalPresentationEffect({ rubric: SOURCE_RUBRICS[entry.debit_canonical_key], side:'debit', amount:entry.amount }); calculateJournalPresentationEffect({ rubric: SOURCE_RUBRICS[entry.credit_canonical_key], side:'credit', amount:entry.amount }); } catch (error) { errors.push({ code:error.message, entry }); }
    const key = identity(entry); if (seen.has(key)) errors.push({ code:'ELIMINATION_DUPLICATE', entry }); else seen.add(key);
    if (analysisType === 'consolidated' && entry.reporting_entity_id && entry.reporting_entity_id !== parentEntityId) errors.push({ code:'ELIMINATION_PARENT_MISMATCH', entry });
  }
  return { valid: errors.length === 0, errors };
}
export function applyEliminations(gross, eliminations) { return applyJournalEntries(gross, eliminations, SOURCE_RUBRICS); }
export function buildAnalysisSeries({ analysisType, entities, parentEntityId, eliminations = [] }) {
  const sum = (ids) => ids.reduce((out,id) => { for (const [key,value] of Object.entries(entities[id]||{})) out[key]=(out[key]||0)+Number(value||0); return out; },{});
  const ids=Object.keys(entities); if(analysisType==='individual') return {individual:sum(ids.slice(0,1))};
  const combined=applyEliminations(sum(ids),eliminations); if(analysisType==='combined') return {combined};
  if(!parentEntityId||!entities[parentEntityId]) throw new Error('CONSOLIDATED_PARENT_REQUIRED'); return {parent:{...entities[parentEntityId]},consolidated:combined};
}
export function reconcileIntercompany({ originValue, destinationValue, eliminatedValue, materiality = MONEY_TOLERANCE }) { const matched=Math.min(Math.abs(originValue),Math.abs(destinationValue));const difference=Math.abs(Math.abs(originValue)-Math.abs(destinationValue));const residual=matched-Math.abs(eliminatedValue);return {originValue,destinationValue,difference,eliminatedValue,residual,status:Math.abs(residual)<=materiality?'matched':difference>materiality?'blocking':'warning'}; }