#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';

const requiredFiles = [
  'src/lib/__tests__/financial-journey.test.jsx',
  'src/lib/__tests__/financial-integrity.test.jsx',
  'src/lib/__tests__/financial-processing.test.jsx',
  'src/lib/__tests__/financial-definition-readonly.test.jsx',
  'src/lib/__tests__/financial-content-hash.test.js',
  'src/lib/__tests__/financial-snapshot-required.test.jsx',
  'src/lib/__tests__/financial-delete-tombstone.test.jsx',
  'src/lib/__tests__/financial-run-concurrency.test.jsx',
  'src/lib/__tests__/financial-validation-failclosed.test.jsx',
  'src/lib/__tests__/seg02-negative.test.js',
  'src/lib/__tests__/fase2-residual3.test.jsx',
  'src/lib/__tests__/phase2-test-inventory.test.js',
  'src/lib/__tests__/verify-runner.test.js',
];
const injected = process.env.PHASE2_REQUIRED_EXTRA;
if (injected) requiredFiles.push(injected);
const missingFiles = requiredFiles.filter((file) => !existsSync(file));
if (missingFiles.length) {
  console.error('Missing phase 2 test files:', missingFiles);
  process.exit(1);
}
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const prohibited = /\b(?:it|test|describe)\s*\.\s*(?:todo|skip)\b|\.\s*(?:skipIf|todoIf)\s*\(/g;
const skipped = [];
for (const file of requiredFiles) {
  const matches = stripComments(readFileSync(file, 'utf8')).match(prohibited) || [];
  if (matches.length) skipped.push({ file, patterns: matches });
}
if (skipped.length) {
  console.error('Phase 2 todo/skip tests are forbidden:', skipped);
  process.exit(1);
}
console.log(`Phase 2 test inventory OK: ${requiredFiles.length} files`);
console.log('phase2_skipped_tests=0');
console.log('phase2_todo_tests=0');