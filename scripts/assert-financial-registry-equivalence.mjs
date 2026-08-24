#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { SOURCE_RUBRICS, CALCULATED_RUBRICS, STATEMENT_TOTALS } from '../src/lib/financial/phase3/canonicalRegistry.js';
import { GENERATED_BACKEND_REGISTRY } from '../src/lib/financial/phase3/generatedFinancialBackendEngine.js';
import { findRegistrySemanticDrift } from '../src/lib/financial/phase3/registryEquivalence.js';

const generated = spawnSync(process.execPath, ['scripts/generate-financial-backend-adapter.mjs'], { encoding:'utf8' });
if (generated.status !== 0) { console.error(generated.stderr); process.exit(1); }
const failures = findRegistrySemanticDrift(SOURCE_RUBRICS, GENERATED_BACKEND_REGISTRY.rubrics);
if (Object.keys(SOURCE_RUBRICS).length !== 44 || Object.keys(CALCULATED_RUBRICS).length !== 9 || Object.keys(STATEMENT_TOTALS).length !== 8) failures.push('REGISTRY_COUNT_DRIFT');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('financial_registry_equivalence=PASS source=44 calculated=9 totals=8 mutation_code=REGISTRY_SEMANTIC_DRIFT');