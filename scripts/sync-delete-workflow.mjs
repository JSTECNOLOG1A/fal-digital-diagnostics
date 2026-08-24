#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const sourcePath = 'src/lib/financial/deleteFinancialUploadWorkflow.js';
const backendPath = 'base44/functions/deleteFinancialUploadSafe/entry.ts';
const source = readFileSync(sourcePath, 'utf8').replace(/^export /gm, '').trim();
const hash = createHash('sha256').update(source).digest('hex');
let backend = readFileSync(backendPath, 'utf8');
backend = backend.replace(/\/\/ generated-source-sha256:\s*[a-f0-9]{64}/, `// generated-source-sha256: ${hash}`);
backend = backend.replace(/\/\/ <generated-delete-workflow>\n[\s\S]*?\n\/\/ <\/generated-delete-workflow>/, `// <generated-delete-workflow>\n${source}\n// </generated-delete-workflow>`);
writeFileSync(backendPath, backend);
console.log(JSON.stringify({ synchronized: true, source_sha256: hash }));