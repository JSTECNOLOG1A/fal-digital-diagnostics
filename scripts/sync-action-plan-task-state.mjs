import { readFileSync, writeFileSync } from 'node:fs';

const canonical = readFileSync('base44/functions/_shared/actionPlanTaskState.ts', 'utf8').trim();
const targets = ['base44/functions/generateActionPlan/entry.ts', 'base44/functions/recalculateActionPlanState/entry.ts'];
const block = `// BEGIN GENERATED ACTION PLAN TASK STATE\n${canonical}\n// END GENERATED ACTION PLAN TASK STATE`;
const generatedBlockPattern = /\/\/ BEGIN GENERATED ACTION PLAN TASK STATE[\s\S]*?\/\/ END GENERATED ACTION PLAN TASK STATE\n*/g;
const legacyFunctionPattern = /export function isActiveActionTask\(task\) \{[\s\S]*?\n\}\n*/g;
const sdkImportPattern = /import \{ createClientFromRequest \} from 'npm:@base44\/sdk@0\.8\.38';/;

for (const file of targets) {
  const source = readFileSync(file, 'utf8');
  const withoutGeneratedBlocks = source.replace(generatedBlockPattern, '').replace(legacyFunctionPattern, '');
  if (!sdkImportPattern.test(withoutGeneratedBlocks)) throw new Error(`ACTION_TASK_STATE_SDK_IMPORT_NOT_FOUND:${file}`);
  const next = withoutGeneratedBlocks.replace(sdkImportPattern, (match) => `${match}\n\n${block}`);
  const blockCount = (next.match(/\/\/ BEGIN GENERATED ACTION PLAN TASK STATE/g) || []).length;
  if (blockCount !== 1) throw new Error(`ACTION_TASK_STATE_BLOCK_COUNT_INVALID:${file}:${blockCount}`);
  writeFileSync(file, next);
}

console.log('action_plan_task_state_sync=generated');