import { readFileSync } from 'node:fs';
const open = readFileSync('base44/functions/createActionPlanReviewWithSnapshot/entry.ts','utf8');
const complete = readFileSync('base44/functions/completeActionPlanReview/entry.ts','utf8');
const required = [['opening',open,'opening_snapshot'],['concurrency',open,'REVIEW_CONCURRENCY_CONFLICT'],['closing',complete,'closing_snapshot'],['recalculate',complete,'recalculateActionPlanState'],['pointer',complete,'current_revision_id']];
const missing = required.filter(([, source, token]) => !source.includes(token)).map(([name]) => name);
if (missing.length) { console.error(`Missing lifecycle controls: ${missing.join(', ')}`); process.exit(1); }
console.log('action_review_lifecycle=pass');