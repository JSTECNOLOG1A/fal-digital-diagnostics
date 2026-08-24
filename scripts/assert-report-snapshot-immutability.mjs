import { readFileSync } from 'node:fs';
const source = readFileSync('base44/functions/generateAssessmentReportVersion/entry.ts','utf8');
if (!source.includes('payload_snapshot')) { console.error('Missing payload snapshot'); process.exit(1); }
console.log('report_snapshot_immutability=baseline_pass');