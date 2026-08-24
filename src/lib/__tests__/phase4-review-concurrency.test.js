import { describe, expect, it } from 'vitest';
import { executeBackendFunction } from '@/lib/phase4/backendFunctionHarness';

const user = { email: 'consultant@fal.test', tenant_id: 'tenant-f4', app_role: 'consultant' };
const seed = { ActionPlan: [{ id: 'plan-1', tenant_id: 'tenant-f4', assessment_id: 'assessment-f4', last_review_number: 0 }], ActionPlanReview: [], ActionTask: [] };

describe('F4 productive review opening', () => {
  it('creates one physical draft and binds the plan pointer', async () => {
    const result = await executeBackendFunction({ functionName: 'createActionPlanReviewWithSnapshot', user, seed, payload: { action_plan_id: 'plan-1', review_date: '2026-07-20' } });
    expect(result.response.status).toBe(200);
    expect(result.state.ActionPlanReview).toHaveLength(1);
    expect(result.state.ActionPlanReview[0]).toMatchObject({ status: 'draft', commit_status: 'active', review_number: 1 });
    expect(result.state.ActionPlan[0].current_revision_id).toBe(result.state.ActionPlanReview[0].id);
  });
});