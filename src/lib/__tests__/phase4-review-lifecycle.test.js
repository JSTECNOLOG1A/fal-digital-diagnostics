import { describe, expect, it } from 'vitest';
import { executeBackendFunction } from '@/lib/phase4/backendFunctionHarness';

const user = { email: 'consultant@fal.test', tenant_id: 'tenant-f4', app_role: 'consultant' };
const seed = { ActionPlan: [{ id: 'plan-1', tenant_id: 'tenant-f4', assessment_id: 'assessment-f4', current_revision_id: 'review-1', last_review_number: 0 }], ActionPlanReview: [{ id: 'review-1', tenant_id: 'tenant-f4', action_plan_id: 'plan-1', review_number: 1, status: 'draft', commit_status: 'active' }], ActionTask: [{ id: 'task-1', tenant_id: 'tenant-f4', plan_id: 'plan-1', title: 'Task', status: 'done', progress_percentage: 100, priority_score: 1, dependency_task_keys: [] }] };

describe('F4 productive review lifecycle', () => {
  it('completes a real draft review with a physical closing snapshot', async () => {
    const result = await executeBackendFunction({ functionName: 'completeActionPlanReview', user, seed, payload: { review_id: 'review-1', executive_summary: 'Completed' } });
    expect(result.response.status).toBe(200);
    expect(result.state.ActionPlanReview[0]).toMatchObject({ status: 'completed', commit_status: 'active' });
    expect(result.state.ActionPlanReview[0].closing_snapshot).toBeTruthy();
    expect(result.state.ActionPlan[0].current_revision_id).toBe('review-1');
  });
  it('rejects completion of a non-draft review through the productive handler', async () => {
    const result = await executeBackendFunction({ functionName: 'completeActionPlanReview', user, seed: { ...seed, ActionPlanReview: [{ ...seed.ActionPlanReview[0], status: 'completed' }] }, payload: { review_id: 'review-1' } });
    expect(result.response.status).toBe(409);
  });
});