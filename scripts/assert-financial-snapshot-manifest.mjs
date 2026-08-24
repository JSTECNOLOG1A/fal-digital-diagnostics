import { readFileSync } from 'node:fs';
const source = readFileSync('base44/functions/buildFinancialStatements/entry.ts', 'utf8');
if (!source.includes("invokeFinancialLifecycleDeterminismEngine(base44, 'build_dfc_lineage_manifest'")) throw new Error('SNAPSHOT_MANIFEST_ENGINE_REQUIRED');
if (!source.includes('const previousSnapshotId = usesSourceHead ? lineage.previous_snapshot_id')) throw new Error('MULTI_HEAD_PREDECESSOR_ENGINE_OUTPUT_REQUIRED');
console.log('financial_snapshot_manifest_contract=PASS canonical_engine_lineage=1');