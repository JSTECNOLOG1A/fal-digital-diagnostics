#!/usr/bin/env node
/**
 * SEG-02 Audit Script — reconciles base44/functions/<name>/entry.ts
 * with the matrix in src/docs/SEG-02_FUNCTION_AUDIT.md
 *
 * Reconciles the endpoint inventory dynamically; no fixed totals are accepted.
 * Exit code 0 = pass, non-zero = divergence.
 */
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const functionsDir = join(root, 'base44', 'functions');
const matrixFile = join(root, 'src', 'docs', 'SEG-02_FUNCTION_AUDIT.md');

// ── 1. List all real function directories ──────────────────────────────────
const realFunctions = readdirSync(functionsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== '_shared')
  .map((d) => d.name)
  .sort();

// Prova negativa reproduzível: simula endpoint novo sem linha na matriz.
if (process.argv.includes('--inject-unclassified-function')) {
  realFunctions.push('__seg02_unclassified_probe__');
}

// ── 2. Parse matrix from markdown ──────────────────────────────────────────
const matrixContent = readFileSync(matrixFile, 'utf-8');
const rowPattern = /^\|\s*\d+\s*\|\s*([a-zA-Z0-9_]+)\s*\|/;
const classPattern =
  /\|\s*(TENANT_GUARDED|HQ_GLOBAL|TENANT_ADMIN_SCOPED|DEPRECATED_410|AUTOMATION_TRUST|PUBLIC_GLOBAL_READ|INTERNAL_MODULE)\s*\|/;

const matrixRows = [];
for (const line of matrixContent.split('\n')) {
  const rowMatch = line.match(rowPattern);
  if (rowMatch) {
    const name = rowMatch[1];
    const classMatch = line.match(classPattern);
    matrixRows.push({ name, classification: classMatch ? classMatch[1] : null });
  }
}

// ── 3. Compare ─────────────────────────────────────────────────────────────
const realSet = new Set(realFunctions);
const matrixNames = matrixRows.map((r) => r.name);
const matrixSet = new Set(matrixNames);

const duplicates = matrixNames.filter((n, i) => matrixNames.indexOf(n) !== i);
const missing = realFunctions.filter((f) => !matrixSet.has(f));
const extras = matrixNames.filter((n) => !realSet.has(n));
const unclassified = matrixRows.filter((r) => !r.classification);

// ── 4. Sum classifications ─────────────────────────────────────────────────
const classSums = {};
for (const r of matrixRows) {
  if (r.classification) {
    classSums[r.classification] = (classSums[r.classification] || 0) + 1;
  }
}
const totalClassified = Object.values(classSums).reduce((a, b) => a + b, 0);

// ── 5. Report ──────────────────────────────────────────────────────────────
console.log('=== SEG-02 Function Audit ===\n');
console.log(`Functions real:       ${realFunctions.length}`);
console.log(`Matrix rows:          ${matrixRows.length}`);
console.log(`Duplicates:           ${duplicates.length}`);
console.log(`Missing (real→mtx):   ${missing.length}`);
console.log(`Extras (mtx→real):    ${extras.length}`);
console.log(`Unclassified:         ${unclassified.length}`);
console.log(`Sum classifications:  ${totalClassified}`);
console.log('\n--- By classification ---');
for (const [cls, count] of Object.entries(classSums).sort()) {
  console.log(`  ${cls}: ${count}`);
}

let hasErrors = false;
if (duplicates.length > 0) {
  console.log(`\n❌ Duplicates: ${duplicates.join(', ')}`);
  hasErrors = true;
}
if (missing.length > 0) {
  console.log(`\n❌ Missing from matrix: ${missing.join(', ')}`);
  hasErrors = true;
}
if (extras.length > 0) {
  console.log(`\n❌ Extras in matrix: ${extras.join(', ')}`);
  hasErrors = true;
}
if (unclassified.length > 0) {
  console.log(`\n❌ Unclassified: ${unclassified.map((r) => r.name).join(', ')}`);
  hasErrors = true;
}
if (realFunctions.length !== matrixRows.length) {
  console.log(
    `\n❌ Count mismatch: real=${realFunctions.length} vs matrix=${matrixRows.length}`
  );
  hasErrors = true;
}
if (totalClassified !== matrixRows.length) {
  console.log(
    `\n❌ Classification sum (${totalClassified}) != matrix rows (${matrixRows.length})`
  );
  hasErrors = true;
}

if (!hasErrors) {
  console.log('\n✅ SEG-02 audit passed — reconciled');
  process.exit(0);
} else {
  console.log('\n❌ SEG-02 audit FAILED');
  process.exit(1);
}