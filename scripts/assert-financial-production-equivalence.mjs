#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { CALCULATED_RUBRICS, FORMULA_VERSION, INDICATORS, REGISTRY_VERSION, SOURCE_RUBRICS, STATEMENT_TOTALS } from '../src/lib/financial/phase3/canonicalRegistry.js';

const read = (path) => readFileSync(path, 'utf8');
const registryBackend = read('base44/functions/getFinancialCanonicalRegistry/entry.ts');
const engineBackend = read('base44/functions/executeFinancialEngine/entry.ts');
const buildBackend = read('base44/functions/buildFinancialStatements/entry.ts');
const prepareBackend = read('base44/functions/prepareFinancialAnalysisDataset/entry.ts');
const snapshotBackend = read('base44/functions/createFinancialProcessingSnapshot/entry.ts');
const violations = [];
const same = (name, actual, expected) => {
  if (JSON.stringify([...actual].sort()) !== JSON.stringify([...expected].sort())) violations.push(`${name}_MISMATCH`);
};
const blockKeys = (source, start, end) => {
  const block = source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
  return [...block.matchAll(/^\s{2}([a-z0-9_]+):\s*\{/gm)].map((match) => match[1]);
};
const sourceKeys = blockKeys(registryBackend, 'const STATEMENT_RUBRIC_REGISTRY = {', '\n};');
const calculatedKeys = blockKeys(registryBackend, 'const CALCULATED_RUBRICS = {', '\n};');
const totalKeys = blockKeys(registryBackend, 'const STATEMENT_TOTALS = {', '\n};');
const indicatorMatch = engineBackend.match(/indicator_codes:\s*\[([^\]]+)\]/s);
const indicatorCodes = indicatorMatch ? [...indicatorMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1]) : [];
same('SOURCE_RUBRICS', sourceKeys, Object.keys(SOURCE_RUBRICS));
same('CALCULATED_RUBRICS', calculatedKeys, Object.keys(CALCULATED_RUBRICS));
same('STATEMENT_TOTALS', totalKeys, Object.keys(STATEMENT_TOTALS));
same('INDICATORS', indicatorCodes, Object.keys(INDICATORS));
if (!engineBackend.includes(`registry_version: '${REGISTRY_VERSION}'`) || !engineBackend.includes(`formula_version: '${FORMULA_VERSION}'`)) violations.push('VERSION_MISMATCH');
if (!engineBackend.includes('// BEGIN GENERATED FAL FINANCIAL ENGINE') || !engineBackend.includes('// END GENERATED FAL FINANCIAL ENGINE')) violations.push('GENERATED_REGION_MISSING');
if (!registryBackend.includes("classification = 'SOURCE_CANONICAL_RUBRIC'") || !registryBackend.includes('elimination_eligible')) violations.push('ELIMINATION_ELIGIBILITY_MISSING');
if (/function\s+(computeAllDerived|calcIndicators)\s*\(/.test(buildBackend)) violations.push('LEGACY_FORMULA_IMPLEMENTATION_PRESENT');
if (!buildBackend.includes("functions.invoke('executeFinancialEngine'") || !prepareBackend.includes("functions.invoke('executeFinancialEngine'")) violations.push('PRODUCTION_ADAPTER_NOT_CONSUMED');
if (!prepareBackend.includes("status: 'posted'") || snapshotBackend.includes("['approved', 'posted']")) violations.push('NON_POSTED_ENTRY_CONSUMPTION');
if (!buildBackend.includes("status: 'committing'") || !buildBackend.includes('SNAPSHOT_POSTCONDITION_FAILED') || !prepareBackend.includes("status: 'committing'")) violations.push('SNAPSHOT_COMMIT_GATE_MISSING');
if (!buildBackend.includes("{ status: 422 }") || !prepareBackend.includes("{ status: 422 }")) violations.push('FAIL_CLOSED_422_MISSING');
console.log(`financial_production_equivalence_violations=${violations.length}`);
if (violations.length) { console.error(violations); process.exit(1); }
console.log(`financial_production_equivalence=PASS source=${sourceKeys.length} calculated=${calculatedKeys.length} totals=${totalKeys.length} indicators=${indicatorCodes.length}`);