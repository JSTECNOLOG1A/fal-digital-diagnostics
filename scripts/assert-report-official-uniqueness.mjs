import { readFileSync } from 'node:fs';
const schema = readFileSync('base44/entities/AssessmentReportVersion.jsonc', 'utf8');
const archive = readFileSync('base44/functions/archiveReportVersion/entry.ts', 'utf8');
if (!schema.includes('mark_as_official') || !archive.includes("status: 'archived'")) { console.error('Report official/archive model incomplete'); process.exit(1); }
console.log('report_official_uniqueness=baseline_guard_pass');