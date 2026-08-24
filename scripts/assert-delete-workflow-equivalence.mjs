#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import process from 'node:process';

const source = readFileSync('src/lib/financial/deleteFinancialUploadWorkflow.js', 'utf8').replace(/^export /gm, '').trim();
const backend = readFileSync('base44/functions/deleteFinancialUploadSafe/entry.ts', 'utf8');
const generated = backend.match(/\/\/ <generated-delete-workflow>\n([\s\S]*?)\n\/\/ <\/generated-delete-workflow>/)?.[1]?.trim();
const declaredHash = backend.match(/generated-source-sha256:\s*([a-f0-9]{64})/)?.[1];
const actualHash = createHash('sha256').update(source).digest('hex');
if (!generated || generated !== source || declaredHash !== actualHash) {
  console.error('Delete workflow divergence', { generated_matches: generated === source, declared_hash: declaredHash, actual_hash: actualHash });
  process.exit(1);
}
console.log(JSON.stringify({ delete_workflow_equivalent: true, source_sha256: actualHash }));