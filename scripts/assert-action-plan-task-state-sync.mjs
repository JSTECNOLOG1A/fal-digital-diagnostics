import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const canonical = readFileSync('base44/functions/_shared/actionPlanTaskState.ts', 'utf8').trim();
const hash = (value) => createHash('sha256').update(value).digest('hex');
for (const file of ['base44/functions/generateActionPlan/entry.ts', 'base44/functions/recalculateActionPlanState/entry.ts']) {
  const source = readFileSync(file, 'utf8');
  const matches = [...source.matchAll(/\/\/ BEGIN GENERATED ACTION PLAN TASK STATE\n([\s\S]*?)\n\/\/ END GENERATED ACTION PLAN TASK STATE/g)];
  if (matches.length !== 1) throw new Error(`ACTION_TASK_STATE_GENERATED_BLOCK_COUNT_INVALID:${file}:${matches.length}`);
  if (hash(matches[0][1].trim()) !== hash(canonical)) throw new Error(`ACTION_TASK_STATE_DRIFT:${file}`);
}
console.log('action_plan_task_state_sync=pass');