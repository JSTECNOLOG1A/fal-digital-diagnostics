import { readFileSync } from 'node:fs';
const source = readFileSync('base44/functions/generatePdfFromReportVersion/entry.ts','utf8');
if (!source.includes('payload_snapshot')) { console.error('PDF must use payload_snapshot'); process.exit(1); }
console.log('pdf_artifact_integrity=baseline_pass');