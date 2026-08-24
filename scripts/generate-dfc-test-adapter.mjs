#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const BACKEND = 'base44/functions/buildFinancialStatements/entry.ts';
const TARGET = 'src/lib/financial/phase3/generatedDfcEngine.js';

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  if (start < 0) throw new Error(`DFC_GENERATION_SOURCE_MISSING:${name}`);
  const brace = source.indexOf(') {', start) + 2;
  if (brace < 2) throw new Error(`DFC_GENERATION_BODY_MISSING:${name}`);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`DFC_GENERATION_UNBALANCED:${name}`);
}

export function generateDfcAdapter() {
  const source = readFileSync(BACKEND, 'utf8');
  const functions = ['norm', 'inferDfcBucketFromRubric', 'resolveDfcBucket', 'buildIndirectCashFlow']
    .map((name) => extractFunction(source, name))
    .join('\n\n');
  const exported = functions.replace('function buildIndirectCashFlow', 'export function buildIndirectCashFlow');
  return `// GENERATED from ${BACKEND}; do not edit manually.\nlet CANONICAL_DFC_BUCKET = {};\nexport function setCanonicalDfcBucket(value = {}) { CANONICAL_DFC_BUCKET = { ...value }; }\n\n${exported}\n`;
}

if (process.argv[1]?.endsWith('generate-dfc-test-adapter.mjs')) {
  const generated = generateDfcAdapter();
  if (process.argv.includes('--check')) {
    if (readFileSync(TARGET, 'utf8') !== generated) throw new Error('DFC_GENERATED_ADAPTER_OUT_OF_SYNC');
    console.log('dfc_generated_adapter=PASS');
  } else {
    writeFileSync(TARGET, generated);
    console.log(`dfc_generated_adapter=UPDATED target=${TARGET}`);
  }
}