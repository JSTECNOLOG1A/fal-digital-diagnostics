import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { phase4Functions, phase4WriterContracts } from './phase4-writer-contracts.mjs';

const root = process.cwd();
const protectedEntities = new Set(['ActionPlan','ActionTask','ActionTaskActivity','ActionTaskReview','ActionPlanReview','ActionPlanGenerationOperation','ActionRecommendation','AssessmentReportVersion','PdfArtifactOrphan']);
const writeMethods = '(create|update|updateMany|delete|deleteMany|bulkCreate|bulkUpdate)';
const violations = [];
const calls = [];
const sourceFor = (functionName) => {
  let source = readFileSync(join(root, 'base44/functions', functionName, 'entry.ts'), 'utf8');
  if (process.argv.includes('--inject-generate-report-update') && functionName === 'generateActionPlan') source += '\nbase44.asServiceRole.entities.AssessmentReportVersion.update("x", {});';
  if (process.argv.includes('--inject-begin-action-task') && functionName === 'beginReportPdfArtifact') source += '\nbase44.asServiceRole.entities.ActionTask.update("x", {});';
  return source;
};
for (const functionName of phase4Functions) {
  const file = join(root, 'base44/functions', functionName, 'entry.ts');
  if (!existsSync(file)) continue;
  const source = sourceFor(functionName);
  for (const match of source.matchAll(new RegExp(`entities\\.([A-Za-z0-9_]+)\\.${writeMethods}\\s*\\(`, 'g'))) {
    const [, entity, method] = match;
    const allowed = phase4WriterContracts[functionName]?.[entity]?.includes(method);
    const item = { function: functionName, entity, method, line: source.slice(0, match.index).split('\n').length };
    calls.push(item);
    if (!allowed) violations.push(item);
  }
}
const frontendFiles = [];
const walkFrontend = (folder) => readdirSync(folder).forEach((name) => {
  const file = join(folder, name);
  if (statSync(file).isDirectory()) walkFrontend(file);
  else if (/\.(js|jsx|ts|tsx)$/.test(name)) frontendFiles.push(file);
});
walkFrontend(join(root, 'src'));
for (const file of frontendFiles) {
  const frontendSource = readFileSync(file, 'utf8');
  for (const match of frontendSource.matchAll(new RegExp(`base44\\.entities\\.([A-Za-z0-9_]+)\\.${writeMethods}\\s*\\(`, 'g'))) {
    const [, entity, method] = match;
    if (protectedEntities.has(entity)) violations.push({ function: 'frontend', path: file.slice(root.length + 1), entity, method, line: frontendSource.slice(0, match.index).split('\n').length });
  }
}
if (process.argv.includes('--inject-frontend-recommendation-update')) violations.push({ function: 'frontend', entity: 'ActionRecommendation', method: 'update', line: 0 });
if (violations.length) { console.error(`PROHIBITED_DIRECT_WRITE: ${JSON.stringify(violations)}`); process.exit(1); }
console.log(`writer_matrix=pass phase4_functions=${phase4Functions.size} calls=${calls.length}`);