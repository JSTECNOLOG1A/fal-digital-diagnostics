import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const engine = 'financialLifecycleDeterminismEngine';
const consumers = ['base44/functions/migrateFinancialOutputLifecycle/entry.ts', 'base44/functions/buildFinancialStatements/entry.ts', 'base44/functions/retryFinancialOutputCleanup/entry.ts'];
const bannedDefinitions = /function\s+(selectCurrentLegacyCandidate|selectCurrentCandidate|buildDfcLineageManifest|evaluateCleanupState|mergeMigrationDiagnosisDelta)\b/;
const violations = [];
for (const file of consumers) { const source = readFileSync(file, 'utf8'); if (!source.includes(engine)) violations.push(`${file}:ENGINE_NOT_INVOKED`); if (bannedDefinitions.test(source)) violations.push(`${file}:LOCAL_RULE_DUPLICATE`); }
const adapter = 'src/lib/financial/phase3/lifecycleDeterminismAdapter.js'; const adapterSource = readFileSync(adapter, 'utf8');
if (/\.sort\(|HEAD_AMBIGUOUS|previous_snapshot_id|cleanup_pending\s*:\s*Boolean/.test(adapterSource)) violations.push(`${adapter}:ADAPTER_HAS_FINANCIAL_LOGIC`);
const scan = (folder) => { for (const entry of readdirSync(folder)) { const path = join(folder, entry); if (statSync(path).isDirectory()) { if (!path.includes('node_modules')) scan(path); } else if (/\.(js|jsx|ts)$/.test(path) && path !== adapter && path !== 'base44/functions/financialLifecycleDeterminismEngine/entry.ts') { const source = readFileSync(path, 'utf8'); if (bannedDefinitions.test(source)) violations.push(`${path}:LOCAL_RULE_DUPLICATE`); } } };
scan('src'); scan('base44/functions');
if (!existsSync('base44/functions/financialLifecycleDeterminismEngine/entry.ts')) violations.push('ENGINE_MISSING');
console.log(`canonical_engine=${engine}`); console.log(`productive_consumers=${consumers.length}`); console.log(`local_duplicates=${violations.filter((item) => item.includes('DUPLICATE')).length}`); console.log(`violations=${violations.length}`);
if (violations.length) throw new Error(violations.join('\n'));