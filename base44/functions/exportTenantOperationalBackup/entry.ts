import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { roleOf, sha256 } from '../../shared/tenantBackupIntegrity.ts';

const entityNames = ['Tenant', 'User', 'PendingUserAccessProfile', 'Group', 'Company', 'OperationalUnit', 'Assessment', 'AssessmentFlowState', 'FalResponse', 'FalDiagnosticSnapshot', 'FinancialDiagnosis', 'FinancialUpload', 'FinancialProcessingSnapshot', 'FinancialStatementLine', 'FinancialIndicatorSnapshot', 'ActionPlan', 'ActionPlanGenerationOperation', 'ActionTask', 'ActionTaskActivity', 'ActionPlanReview', 'ActionTaskReview', 'ActionRecommendation', 'FinancialRecommendation', 'FinancialActionProposal', 'FinancialFinding', 'AssessmentReportVersion', 'AuditLog'];
async function fetchAll(entity, filter) { const rows = []; let cursor = null; while (true) { const page = await entity.filter(cursor ? { ...filter, id: { $gt: cursor } } : filter, 'id', 500); if (!page.length) break; rows.push(...page); cursor = page.at(-1).id; if (page.length < 500) break; } return rows; }
function sanitizeUser(user) { return { id: user.id, full_name: user.full_name || null, email: user.email || null, role: user.role || null, app_role: user.app_role || null, tenant_id: user.tenant_id || null, client_id: user.client_id || null, access_status: user.access_status || 'active', revoked_at: user.revoked_at || null, created_date: user.created_date || null, updated_date: user.updated_date || null }; }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req); const actor = await base44.auth.me();
    if (!actor) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { tenant_id: tenantId } = await req.json(); const role = roleOf(actor);
    if (!tenantId || !['hq_admin', 'tenant_admin'].includes(role || '')) return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (role === 'tenant_admin' && actor.tenant_id !== tenantId) return Response.json({ error: 'TENANT_MISMATCH' }, { status: 403 });
    const tenant = await base44.asServiceRole.entities.Tenant.get(tenantId).catch(() => null);
    if (!tenant) return Response.json({ error: 'Tenant não encontrado' }, { status: 404 });
    const data = {}; const files = {};
    for (const name of entityNames) {
      const rows = name === 'Tenant' ? [tenant] : name === 'User' ? (await fetchAll(base44.asServiceRole.entities.User, { tenant_id: tenantId })).map(sanitizeUser) : await fetchAll(base44.asServiceRole.entities[name], { tenant_id: tenantId });
      data[name] = rows; files[`${name}.json`] = { count: rows.length, sha256: await sha256(rows) };
    }
    const manifest = { format: 'fal-tenant-backup', format_version: 2, tenant_id: tenantId, created_at: new Date().toISOString(), created_by: actor.id, entities: files, schema_version: 'FAL-v2.60' };
    manifest.global_sha256 = await sha256({ manifest: { ...manifest, global_sha256: null }, data });
    await base44.asServiceRole.entities.AuditLog.create({ tenant_id: tenantId, action: 'TENANT_BACKUP_EXPORTED', actor_email: actor.email, actor_app_role: role, entity_type: 'Tenant', entity_id: tenantId, timestamp: new Date().toISOString(), details: { entity_count: entityNames.length, global_sha256: manifest.global_sha256 } });
    return Response.json({ manifest, data });
  } catch (error) { return Response.json({ error: 'Não foi possível gerar o backup operacional.' }, { status: 500 }); }
});