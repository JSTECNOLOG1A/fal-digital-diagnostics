import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const versionedEntities = ['FinancialStatementLine', 'FinancialIndicatorSnapshot', 'FinancialValidationResult', 'FinancialMappingResolution', 'FinancialTrialBalanceLine', 'FinancialDfcCompositionLine', 'PreparedFinancialDatasetLine'];
const files = [];
function walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(ts|js|jsx)$/.test(path)) files.push(path);
  }
}
function callEnd(source, start) {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '(') depth += 1;
    if (source[index] === ')') { depth -= 1; if (depth === 0) return index + 1; }
  }
  return source.length;
}
walk('base44/functions');
const failures = []; let writers = 0;
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const entity of versionedEntities) {
    const expression = new RegExp(`entities\\.${entity}\\.(?:create|bulkCreate)\\(`, 'g');
    for (const match of source.matchAll(expression)) {
      writers += 1;
      const start = match.index;
      const context = source.slice(Math.max(0, start - 3500), Math.min(source.length, callEnd(source, start) + 5000));
      const hasExplicitFields = /processing_run_id\s*[:=]/.test(context) && /publication_status\s*[:=]/.test(context);
      const hasApprovedStamper = /stampCandidates\s*\(/.test(context) && /processing_run_id\s*=/.test(source) && /publication_status\s*=/.test(source);
      if (!hasExplicitFields && !hasApprovedStamper) failures.push(`${file}:${entity}@${start}`);
    }
  }
}
console.log(`financial_writer_lifecycle_calls=${writers} failures=${failures.length}`);
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }