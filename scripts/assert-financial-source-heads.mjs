import { readFileSync } from 'node:fs';
const source = readFileSync('base44/functions/buildFinancialStatements/entry.ts', 'utf8');
if (!source.includes("invokeFinancialLifecycleDeterminismEngine(base44, 'build_dfc_lineage_manifest'")) throw new Error('DFC_LINEAGE_ENGINE_CONSUMER_REQUIRED');
if (source.includes('sourceOutputsByIdentity')) throw new Error('PARALLEL_DFC_LINEAGE_IMPLEMENTATION');
console.log('financial_source_heads_contract=PASS canonical_engine_consumer=build_dfc_lineage_manifest');