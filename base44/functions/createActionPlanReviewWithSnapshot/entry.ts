import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
function resolveAppRole(user) { if (!user) return null; if (VALID_APP_ROLES.has(user.app_role)) return user.app_role; return user.role === 'admin' ? 'hq_admin' : null; }
function assertCanWrite(effectiveRole) { if (!WRITE_ROLES.has(effectiveRole)) throw Object.assign(new Error('Forbidden: write permission required'), { status: 403 }); }
async function readAllById(entity, query, order = 'id', pageSize = 500) { const rows = []; let cursor = null; while (true) { const page = await entity.filter(cursor ? { ...query, id: { $gt: cursor } } : query, order, pageSize); if (!page.length) break; rows.push(...page); if (page.length < pageSize) break; cursor = page[page.length - 1].id; } return rows; }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const effectiveRole = resolveAppRole(user);
    assertCanWrite(effectiveRole);
    const { action_plan_id, review_date, visit_type = 'intermediate' } = await req.json();
    if (!action_plan_id || !review_date) return Response.json({ error: 'action_plan_id and review_date are required' }, { status: 400 });
    const plan = await base44.asServiceRole.entities.ActionPlan.get(action_plan_id);
    if (!plan) return Response.json({ error: 'Action plan not found' }, { status: 404 });
    if (effectiveRole !== 'hq_admin' && plan.tenant_id !== user.tenant_id) return Response.json({ error: 'Forbidden: tenant mismatch' }, { status: 403 });
    const reviewKey = `${plan.tenant_id}|${plan.id}|open`;
    const pointed = plan.current_revision_id ? await base44.asServiceRole.entities.ActionPlanReview.get(plan.current_revision_id) : null;
    if (pointed?.status === 'draft' && pointed.commit_status === 'active') return Response.json({ review: pointed, reused: true });
    const reviews = await readAllById(base44.asServiceRole.entities.ActionPlanReview, { action_plan_id: plan.id, tenant_id: plan.tenant_id });
    const existing = reviews.find((item) => item.review_key === reviewKey && item.status === 'draft' && item.commit_status === 'active');
    if (existing) return Response.json({ review: existing, reused: true });
    const tasks = await readAllById(base44.asServiceRole.entities.ActionTask, { plan_id: plan.id, tenant_id: plan.tenant_id });
    const candidate = await base44.asServiceRole.entities.ActionPlanReview.create({ action_plan_id: plan.id, assessment_id: plan.assessment_id, tenant_id: plan.tenant_id, review_key: reviewKey, operation_key: crypto.randomUUID(), commit_status: 'candidate', review_number: Math.max(0, ...reviews.map((item) => Number(item.review_number) || 0)) + 1, review_date, visit_type, consultant_id: user.id, consultant_name: user.full_name || user.email, status: 'draft', opening_snapshot: { opened_at: new Date().toISOString(), opened_by: user.email, task_state_before: tasks.map((task) => ({ task_id: task.id, task_key: task.task_key, status: task.status, progress_percentage: task.progress_percentage, due_date: task.due_date })) } });
    await base44.asServiceRole.entities.ActionPlan.update(plan.id, { current_revision_id: candidate.id, updated_at: new Date().toISOString(), updated_by: user.email });
    const confirmedPlan = await base44.asServiceRole.entities.ActionPlan.get(plan.id);
    if (confirmedPlan.current_revision_id !== candidate.id) {
      await base44.asServiceRole.entities.ActionPlanReview.update(candidate.id, { status: 'cancelled', commit_status: 'invalid', cancellation_reason: 'REVIEW_CONCURRENCY_CONFLICT' });
      return Response.json({ error: 'REVIEW_CONCURRENCY_CONFLICT' }, { status: 409 });
    }
    const drafts = await readAllById(base44.asServiceRole.entities.ActionPlanReview, { action_plan_id: plan.id, tenant_id: plan.tenant_id, status: 'draft' });
    for (const rival of drafts.filter((item) => item.id !== candidate.id && item.commit_status === 'candidate')) await base44.asServiceRole.entities.ActionPlanReview.update(rival.id, { status: 'cancelled', commit_status: 'invalid', cancellation_reason: 'Concurrent review opening collision' });
    const review = await base44.asServiceRole.entities.ActionPlanReview.update(candidate.id, { commit_status: 'active' });
    return Response.json({ review, reused: false });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
});