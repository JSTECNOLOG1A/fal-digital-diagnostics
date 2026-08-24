import { readFileSync } from 'node:fs';
const source=readFileSync('base44/functions/generateActionPlan/entry.ts','utf8');
const required=['converted_to_tasks','item.action_plan_id === previousPlan?.id','canonicalRecommendation','financial_status','reused: true','source_financial_snapshot_ids'];
const missing=required.filter(token=>!source.includes(token));
if(missing.length){console.error(`ACTION_PLAN_FINGERPRINT_INCOMPLETE: ${missing.join(', ')}`);process.exit(1);}
console.log('action_plan_fingerprint=pass');