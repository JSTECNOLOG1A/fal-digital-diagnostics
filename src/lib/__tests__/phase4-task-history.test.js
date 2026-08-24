import { describe, expect, it } from 'vitest';
import { executeBackendFunction } from '@/lib/phase4/backendFunctionHarness';

const user = { email: 'consultant@fal.test', tenant_id: 'tenant-f4', app_role: 'consultant' };
const seed = { ActionPlan: [{ id: 'plan-1', tenant_id: 'tenant-f4', total_tasks: 1 }], ActionTask: [{ id: 'task-1', tenant_id: 'tenant-f4', plan_id: 'plan-1', title: 'Task', status: 'todo', progress_percentage: 0, priority: 'high', priority_score: 1, dependency_task_keys: [] }], ActionTaskActivity: [], ActionTaskReview: [] };

describe('F4 productive task history', () => {
  it('executes the real task handler and persists task history activation', async () => {
    const result = await executeBackendFunction({ functionName: 'updateActionTaskWithHistory', user, seed, payload: { task_id: 'task-1', updates: { status: 'in_progress', progress_percentage: 20, assigned_to: 'owner@fal.test', start_date: '2026-07-20' } } });
    expect(result.productiveSourcePath).toContain('updateActionTaskWithHistory/entry.ts');
    expect(result.response.status).toBe(200);
    expect(result.state.ActionTask[0]).toMatchObject({ status: 'in_progress', progress_percentage: 20 });
    expect(result.state.ActionTaskActivity[0].commit_status).toBe('active');
  });

  it('enforces evidence when completing a task through the productive handler', async () => {
    const result = await executeBackendFunction({ functionName: 'updateActionTaskWithHistory', user, seed, payload: { task_id: 'task-1', updates: { status: 'done', progress_percentage: 100 } } });
    expect(result.response.status).toBe(409);
    expect(result.response.body.error).toContain('done requires');
  });
});