import { readFileSync } from 'node:fs';
const source = readFileSync('base44/functions/migrateFinancialOutputLifecycle/entry.ts', 'utf8');
if (!source.includes("invokeEngine(base44, 'select_current_legacy_candidates'")) throw new Error('MIGRATION_SELECTION_ENGINE_REQUIRED');
if (!source.includes("invokeEngine(base44, 'merge_migration_diagnosis_delta'")) throw new Error('MIGRATION_DELTA_ENGINE_REQUIRED');
if (/function\s+selectCurrentLegacyCandidate\b/.test(source)) throw new Error('MIGRATION_LOCAL_SELECTION_DUPLICATE');
if (!source.includes('const blocked = ambiguous.length > 0')) throw new Error('AMBIGUITY_FAIL_CLOSED_REQUIRED');
console.log('financial_migration_completeness_contract=PASS engine_selection=1 engine_delta=1 ambiguity_fail_closed=1');