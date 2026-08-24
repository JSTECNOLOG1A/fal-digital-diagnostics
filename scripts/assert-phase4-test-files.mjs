import { existsSync, readFileSync } from 'node:fs';
const files=['phase4-action-plan.test.js','phase4-task-history.test.js','phase4-review-lifecycle.test.js','phase4-review-concurrency.test.js','phase4-report-version.test.js','phase4-report-official.test.js','phase4-pdf-reproducibility.test.js','phase4-rbac.test.js','phase4-e2e-cycle.test.js'].map(n=>`src/lib/__tests__/${n}`);
const missing=files.filter(f=>!existsSync(f));
const weak=files.filter(f=>{const s=readFileSync(f,'utf8');return (s.match(/\bit\s*\(/g)||[]).length<3||/\b(it|test)\.(todo|skip)\b/.test(s);});
if(missing.length||weak.length){console.error(JSON.stringify({missing,weak}));process.exit(1);}
console.log(`phase4_test_inventory=pass files=${files.length} minimum_tests=27`);