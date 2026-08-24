import { mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { computeTreeSha, copyProductTree, persistOutput, removeTree, replaceExactly, runCommand } from './phase4-mutation-utils.mjs';

const root = process.cwd();
const node = process.execPath;
const test = (file) => [node, ['node_modules/vitest/vitest.mjs', 'run', file]];
const actionPlan = test('src/lib/__tests__/phase4-action-plan.test.js');
const taskState = [node, ['scripts/assert-action-plan-task-state-sync.mjs']];
const writers = [node, ['scripts/assert-action-task-writers.mjs']];
const mutations = [
  { id: 'MUT-I', file: 'base44/functions/generateActionPlan/entry.ts', from: 'await rollbackGeneration({ ...transactionContext, error });', to: 'if (false) { await rollbackGeneration({ ...transactionContext, error }); }', test: actionPlan, audit: actionPlan },
  { id: 'MUT-J', file: 'base44/functions/generateActionPlan/entry.ts', from: 'if (rows.length > 1) duplicates.push(key);', to: 'if (confirmedTasks.length !== expectedKeys.size) duplicates.push(key);', test: actionPlan, audit: taskState },
  { id: 'MUT-K', file: 'base44/functions/generateActionPlan/entry.ts', from: 'const committedGeneration = await resolveCommittedGeneration({ base44, tenantId, assessmentId, plan: previousPlan, generationFingerprint });', to: 'const committedGeneration = { reusable: false, conflict: false };', test: actionPlan, audit: actionPlan },
  { id: 'MUT-L', file: 'base44/functions/generateActionPlan/entry.ts', from: "operation_id: generationOperationId, operation_status: 'candidate'", to: "generation_operation_id: generationOperationId, operation_status: 'candidate'", test: actionPlan, audit: actionPlan },
  { id: 'MUT-M', file: 'base44/functions/generateActionPlan/entry.ts', from: 'generation_fingerprint: previousPlan?.generation_fingerprint || null,', to: 'generation_fingerprint: generationFingerprint /* MUT-M */,', test: actionPlan, audit: actionPlan },
  { id: 'MUT-N', file: 'base44/functions/generateActionPlan/entry.ts', from: 'action_plan_id: snapshot?.action_plan_id ?? null, converted_task_ids: snapshot?.converted_task_ids ?? [],', to: 'action_plan_id: null, converted_task_ids: [],', test: actionPlan, audit: actionPlan },
  { id: 'MUT-O', file: 'base44/functions/generateActionPlan/entry.ts', from: "const recalcResponse = await base44.asServiceRole.functions.invoke('recalculateActionPlanState', { action_plan_id: plan.id });", to: 'const recalcResponse = { status: 200, data: { plan } };', test: actionPlan, audit: actionPlan },
  { id: 'MUT-P', file: 'base44/functions/generateActionPlan/entry.ts', from: 'const activeResponseTasks = confirmedTasks.filter(isActiveActionTask);', to: 'const activeResponseTasks = resultTasks;', test: actionPlan, audit: actionPlan },
  { id: 'MUT-Q', file: 'base44/functions/generateActionPlan/entry.ts', from: 'let reusedTasks = (await fetchAll(base44.asServiceRole.entities.ActionTask, { tenant_id: tenantId, plan_id: previousPlan.id })).filter(isActiveActionTask);', to: "let reusedTasks = (await fetchAll(base44.asServiceRole.entities.ActionTask, { tenant_id: tenantId, plan_id: previousPlan.id })).filter((task) => task.operation_status === 'active');", test: actionPlan, audit: taskState },
  { id: 'MUT-R', file: 'base44/functions/generateActionPlan/entry.ts', from: 'action_plan_operation_id: operation.operation_id', to: 'action_plan_operation_id: null', test: actionPlan, audit: actionPlan },
  { id: 'MUT-S', file: 'base44/functions/generateActionPlan/entry.ts', from: 'const activeOperation = await base44.asServiceRole.entities.ActionPlanGenerationOperation.update', to: "await base44.asServiceRole.entities.AssessmentReportVersion.update('probe', { status: 'active' });\n   const activeOperation = await base44.asServiceRole.entities.ActionPlanGenerationOperation.update", test: writers, audit: writers },
  { id: 'MUT-T', file: 'base44/functions/generateActionPlan/entry.ts', from: "return task?.status !== 'cancelled' && (!task?.operation_status || task.operation_status === 'active');", to: "return task?.status !== 'cancelled' && task?.operation_status === 'active';", test: actionPlan, audit: taskState },
];

const before = computeTreeSha(root);
const results = [];
for (const mutation of mutations) {
  const temp = mkdtempSync(join(tmpdir(), 'fal-phase4-mut-'));
  try {
    copyProductTree({ source: root, target: temp });
    symlinkSync(resolve(root, 'node_modules'), join(temp, 'node_modules'), 'dir');
    const patch = replaceExactly({ file: join(temp, mutation.file), from: mutation.from, to: mutation.to });
    const [testCommand, testArgs] = mutation.test;
    const [auditCommand, auditArgs] = mutation.audit;
    const testResult = await runCommand({ cwd: temp, command: testCommand, args: testArgs, timeoutMs: 120000 });
    const auditResult = await runCommand({ cwd: temp, command: auditCommand, args: auditArgs, timeoutMs: 120000 });
    const testFiles = persistOutput({ root, mutationId: mutation.id, label: 'test', output: testResult });
    const auditFiles = persistOutput({ root, mutationId: mutation.id, label: 'audit', output: auditResult });
    results.push({ id: mutation.id, target_file: mutation.file, patch_applied: patch.count === 1, test_command: `${testCommand} ${testArgs.join(' ')}`, test_exit: testResult.exitCode, audit_command: `${auditCommand} ${auditArgs.join(' ')}`, audit_exit: auditResult.exitCode, detected: testResult.exitCode !== 0 && auditResult.exitCode !== 0, stdout_file: testFiles.stdoutFile, stderr_file: testFiles.stderrFile, audit_stdout_file: auditFiles.stdoutFile, audit_stderr_file: auditFiles.stderrFile, duration_ms: testResult.durationMs + auditResult.durationMs });
  } catch (error) {
    results.push({ id: mutation.id, target_file: mutation.file, patch_applied: false, detected: false, error: error.message });
  } finally { removeTree(temp); }
}
const after = computeTreeSha(root);
const report = { tree_sha_before: before, tree_sha_after: after, original_tree_unchanged: before === after, all_detected: before === after && results.length === mutations.length && results.every((item) => item.detected), mutations: results };
writeFileSync(join(root, 'src/docs/FASE4_MUTATION_RESULTS_V254.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
process.exitCode = report.all_detected ? 0 : 1;