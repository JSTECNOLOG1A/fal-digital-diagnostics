#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { REGISTRY, SOURCE_RUBRICS, CALCULATED_RUBRICS, STATEMENT_TOTALS, INDICATORS, UI_ONLY_KEYS, ALIASES, validateRegistry } from '../src/lib/financial/phase3/canonicalRegistry.js';
import { assertUniqueFinancialLines } from '../src/lib/financial/phase3/statementEngine.js';

const validation = validateRegistry(REGISTRY);
const violations = [...validation.violations];
const backend = readFileSync('base44/functions/getFinancialCanonicalRegistry/entry.ts', 'utf8');
for (const key of UI_ONLY_KEYS) {
  const rubricPattern = new RegExp(`\\b${key}\\s*:\\s*\\{[^}]*statement_code`, 's');
  if (rubricPattern.test(backend)) violations.push({ code:'BACKEND_SERIES_KEY_AS_RUBRIC', key });
}
for (const key of Object.keys(INDICATORS)) {
  const rubricPattern = new RegExp(`\\b${key}\\s*:\\s*\\{[^}]*line_type:\\s*['\"]source`, 's');
  if (rubricPattern.test(backend)) violations.push({ code:'BACKEND_INDICATOR_AS_RUBRIC', key });
}
for (const alias of Object.keys(ALIASES)) if (SOURCE_RUBRICS[alias]) violations.push({ code:'ALIAS_AS_SOURCE', key:alias });
const syntheticLines = Object.keys(SOURCE_RUBRICS).map((canonical_key, index) => ({ financial_diagnosis_id:'audit', canonical_key, period:'2025', dataset_scope:'individual', entity_code:'A', reporting_entity_id:'A', financial_upload_id:`u${index}` }));
const uniqueness = assertUniqueFinancialLines(syntheticLines);
if (!uniqueness.valid) violations.push(...uniqueness.duplicates.map(key => ({ code:'DUPLICATE_SCOPE_KEY', key })));
console.log(JSON.stringify({ registry_version:'3.0.0', registry_violations:violations.length, counts:{ ...validation.counts, backend_source_bytes:backend.length, source_rubrics:Object.keys(SOURCE_RUBRICS).length, calculated_rubrics:Object.keys(CALCULATED_RUBRICS).length, statement_totals:Object.keys(STATEMENT_TOTALS).length, indicators:Object.keys(INDICATORS).length } }, null, 2));
if (violations.length) { console.error(JSON.stringify(violations, null, 2)); process.exit(1); }