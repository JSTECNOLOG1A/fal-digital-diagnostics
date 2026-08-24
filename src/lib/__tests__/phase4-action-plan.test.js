import { describe, expect, it } from 'vitest';
import { executeBackendFunction } from '@/lib/phase4/backendFunctionHarness';
import { createPhase4ProductiveFixture } from '@/lib/phase4/phase4ProductiveFixtures';

describe('F4 productive action-plan generation', () => {
  it('creates a physical plan, task and recommendation linkage through the productive handler', async () => {
    const fixture = createPhase4ProductiveFixture();
    const result = await executeBackendFunction({ functionName: 'generateActionPlan', payload: { assessmentId: 'assessment-f4', cycleId: 'cycle-f4' }, ...fixture });
    expect(result.productiveSourcePath).toContain('generateActionPlan/entry.ts');
    expect(result.response.status).toBe(200);
    expect(result.state.ActionPlan).toHaveLength(1);
    expect(result.state.ActionPlan[0].generation_fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.state.ActionPlan[0].source_financial_snapshot_ids).toContain('financial-snapshot-1');
    expect(result.state.ActionTask.some((task) => task.task_key.startsWith('rec::recommendation-1'))).toBe(true);
    expect(result.state.ActionRecommendation[0]).toMatchObject({ status: 'converted_to_tasks', action_plan_id: result.state.ActionPlan[0].id });
    expect(result.state.AssessmentFlowState[0].action_plan_status).toBe('done');
  });

  it('rejects ambiguous active plan identities without mutations', async () => {
    const fixture = createPhase4ProductiveFixture();
    fixture.seed.ActionPlan = [{ id: 'plan-a', tenant_id: 'tenant-f4', assessment_id: 'assessment-f4', plan_key: 'tenant-f4|assessment-f4|company|company-f4', status: 'active' }, { id: 'plan-b', tenant_id: 'tenant-f4', assessment_id: 'assessment-f4', plan_key: 'tenant-f4|assessment-f4|company|company-f4', status: 'active' }];
    const result = await executeBackendFunction({ functionName: 'generateActionPlan', payload: { assessmentId: 'assessment-f4', cycleId: 'cycle-f4' }, ...fixture });
    expect(result.response.status).toBe(409);
    expect(result.response.body.error).toBe('ACTION_PLAN_IDENTITY_AMBIGUOUS');
    expect(result.mutations).toHaveLength(0);
  });

  it('AP-21 creates an operation-bound flow and commits it active', async () => {
    const fixture = createPhase4ProductiveFixture();
    fixture.seed.AssessmentFlowState = [];
    const result = await executeBackendFunction({ functionName: 'generateActionPlan', payload: { assessmentId: 'assessment-f4', cycleId: 'cycle-f4' }, ...fixture });
    const flow = result.state.AssessmentFlowState[0];
    expect(result.response.status).toBe(200);
    expect(flow).toMatchObject({ action_plan_status: 'done', action_plan_operation_status: 'active' });
    expect(flow.action_plan_operation_id).toBeTruthy();
  });

  it('AP-22 leaves no flow when creation fails before persistence', async () => {
    const fixture = createPhase4ProductiveFixture();
    fixture.seed.AssessmentFlowState = [];
    const result = await executeBackendFunction({ functionName: 'generateActionPlan', payload: { assessmentId: 'assessment-f4', cycleId: 'cycle-f4' }, failurePlan: { 'AssessmentFlowState.create': { before: { atCall: 1, message: 'FLOW_CREATE_BEFORE' } } }, ...fixture });
    expect(result.response.status).toBe(500);
    expect(result.state.AssessmentFlowState).toHaveLength(0);
  });

  it('AP-23 locates a flow persisted before an after-failure and invalidates it', async () => {
    const fixture = createPhase4ProductiveFixture();
    fixture.seed.AssessmentFlowState = [];
    const result = await executeBackendFunction({ functionName: 'generateActionPlan', payload: { assessmentId: 'assessment-f4', cycleId: 'cycle-f4' }, failurePlan: { 'AssessmentFlowState.create': { after: { atCall: 1, message: 'FLOW_CREATE_AFTER' } } }, ...fixture });
    expect(result.response.status).toBe(500);
    expect(result.state.AssessmentFlowState[0]).toMatchObject({ action_plan_status: 'pending', action_plan_operation_status: 'invalid', action_plan_id: null });
  });

  it('AP-24 records the invalidation reason for an after-failure flow', async () => {
    const fixture = createPhase4ProductiveFixture();
    fixture.seed.AssessmentFlowState = [];
    const result = await executeBackendFunction({ functionName: 'generateActionPlan', payload: { assessmentId: 'assessment-f4', cycleId: 'cycle-f4' }, failurePlan: { 'AssessmentFlowState.create': { after: { atCall: 1, message: 'FLOW_CREATE_AFTER' } } }, ...fixture });
    expect(result.state.AssessmentFlowState[0].action_plan_operation_invalidation_reason).toBe('FLOW_CREATE_AFTER');
  });

  it('AP-25 retries cleanly after an after-failure flow rollback', async () => {
    const fixture = createPhase4ProductiveFixture();
    fixture.seed.AssessmentFlowState = [];
    const failed = await executeBackendFunction({ functionName: 'generateActionPlan', payload: { assessmentId: 'assessment-f4', cycleId: 'cycle-f4' }, failurePlan: { 'AssessmentFlowState.create': { after: { atCall: 1, message: 'FLOW_CREATE_AFTER' } } }, ...fixture });
    const retrySeed = { ...failed.state, ActionPlan: [], ActionPlanGenerationOperation: [], ActionTask: [] };
    const retry = await executeBackendFunction({ functionName: 'generateActionPlan', payload: { assessmentId: 'assessment-f4', cycleId: 'cycle-f4' }, seed: retrySeed, user: fixture.user });
    expect(retry.response.status).toBe(200);
    expect(retry.state.AssessmentFlowState.some((flow) => flow.action_plan_operation_status === 'active')).toBe(true);
  });

  it('AP-26 restores the prior operation metadata on an existing flow failure', async () => {
    const fixture = createPhase4ProductiveFixture();
    fixture.seed.AssessmentFlowState[0] = { ...fixture.seed.AssessmentFlowState[0], tenant_id: 'tenant-f4', action_plan_operation_id: 'old-operation', action_plan_operation_status: 'active' };
    const result = await executeBackendFunction({ functionName: 'generateActionPlan', payload: { assessmentId: 'assessment-f4', cycleId: 'cycle-f4' }, failurePlan: { 'AssessmentFlowState.update': { after: { atCall: 1, message: 'FLOW_UPDATE_AFTER' } } }, ...fixture });
    expect(result.response.status).toBe(500);
    expect(result.state.AssessmentFlowState[0]).toMatchObject({ action_plan_operation_id: 'old-operation', action_plan_operation_status: 'active', action_plan_status: 'pending' });
  });
});