import { readFileSync } from 'node:fs';
const s=readFileSync('base44/functions/createFinancialProcessingSnapshot/entry.ts','utf8');
const required=['processing_run_id','publication_status','SNAPSHOT_RUN_OUTPUTS_REQUIRED'];
const forbidden=['Fallback: todos os outputs do diagnóstico','else {\n      // Fallback: todos os outputs'];
const failures=[...required.filter(x=>!s.includes(x)),...forbidden.filter(x=>s.includes(x))];
console.log(`financial_snapshot_run_scope=${failures.length?'FAIL':'PASS'}`);if(failures.length){console.error(failures);process.exit(1);}