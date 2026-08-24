import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const versioned = new Set(['FinancialStatementLine','FinancialIndicatorSnapshot','FinancialValidationResult','FinancialMappingResolution','FinancialTrialBalanceLine','FinancialDfcCompositionLine','PreparedFinancialDatasetLine']);
const rules = new Map(JSON.parse(readFileSync('scripts/financial-read-classification.json', 'utf8')).rules.map((rule) => [rule.path, rule.classification]));
const failures = [];
let filesScanned = 0;
let callsScanned = 0;
let classifiedCalls = 0;

function collect(directory, files = []) {
  for (const name of readdirSync(directory)) {
    if (['node_modules', 'dist', 'scripts', '__tests__', '__tests_rc1__'].includes(name)) continue;
    const file = join(directory, name);
    if (statSync(file).isDirectory()) collect(file, files);
    else if (/\.(js|jsx|ts|tsx)$/.test(name)) files.push(file);
  }
  return files;
}

for (const file of [...collect(join(root, 'src')), ...collect(join(root, 'base44', 'functions'))]) {
  const path = relative(root, file).replaceAll('\\', '/');
  const source = readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  filesScanned += 1;
  const classification = rules.get(path);
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ['filter','list','get'].includes(node.expression.name.text)) {
      const entity = ts.isPropertyAccessExpression(node.expression.expression) ? node.expression.expression.name.text : null;
      if (versioned.has(entity)) {
        callsScanned += 1;
        const query = node.arguments[0]?.getText(ast) || '';
        if (!classification) failures.push(`${path}:${ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1}:${entity}:UNCLASSIFIED`);
        else {
          classifiedCalls += 1;
          const scopedInline = query.includes('processing_run_id') && /publication_status\s*:\s*['\"]active['\"]/.test(query);
          const scopedBase = /^qBase$/.test(query) && source.includes("const qBase = { financial_diagnosis_id, processing_run_id:currentScope.processing_run_id, publication_status:'active' }");
          if (classification === 'CURRENT_OUTPUT' && !scopedInline && !scopedBase) failures.push(`${path}:${ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1}:${entity}:CURRENT_OUTPUT_SCOPE_REQUIRED`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
}
console.log(`files_scanned=${filesScanned} calls_scanned=${callsScanned} classified_calls=${classifiedCalls} failures=${failures.length}`);
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }