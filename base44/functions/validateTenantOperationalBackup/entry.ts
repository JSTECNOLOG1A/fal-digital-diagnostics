import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { roleOf, sha256 } from '../../shared/tenantBackupIntegrity.ts';

const relations = { Company: [['group_id', 'Group']], OperationalUnit: [['company_id', 'Company']], Assessment: [['group_id', 'Group'], ['company_id', 'Company'], ['unit_id', 'OperationalUnit']], AssessmentFlowState: [['assessment_id', 'Assessment']], ActionPlan: [['assessment_id', 'Assessment']], ActionPlanGenerationOperation: [['assessment_id', 'Assessment'], ['action_plan_id', 'ActionPlan']], ActionTask: [['plan_id', 'ActionPlan'], ['assessment_id', 'Assessment']], ActionTaskActivity: [['action_task_id', 'ActionTask'], ['action_plan_id', 'ActionPlan']], ActionPlanReview: [['action_plan_id', 'ActionPlan'], ['assessment_id', 'Assessment']], ActionTaskReview: [['action_plan_review_id', 'ActionPlanReview'], ['action_plan_id', 'ActionPlan'], ['action_task_id', 'ActionTask']], AssessmentReportVersion: [['assessment_id', 'Assessment'], ['action_plan_id', 'ActionPlan']] };
async function fetchAll(entity, filter) { const rows = []; let cursor = null; while (true) { const page = await entity.filter(cursor ? { ...filter, id: { $gt: cursor } } : filter, 'id', 500); if (!page.length) break; rows.push(...page); cursor = page.at(-1).id; if (page.length < 500) break; } return rows; }
function fingerprint(row) { const { created_date, updated_date, created_by_id, ...value } = row; return JSON.stringify(value); }
function validateReferences(data, tenantId) { const errors = []; const ids = Object.fromEntries(Object.entries(data).map(([name, rows]) => [name, new Set((rows || []).map((row) => row.id))])); for (const [name, refs] of Object.entries(relations)) for (const row of data[name] || []) { if (row.tenant_id && row.tenant_id !== tenantId) errors.push(`${name}:${row.id}: tenant divergente`); for (const [field, target] of refs) if (row[field] && !ids[target]?.has(row[field])) errors.push(`${name}:${row.id}: referência órfã ${field}`); } return errors; }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req); const actor = await base44.auth.me();
    if (!actor) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { backup, destination_tenant_id: destinationTenantId } = await req.json(); const role = roleOf(actor);
    if (!['hq_admin', 'tenant_admin'].includes(role || '')) return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (!backup?.manifest || !backup?.data || backup.manifest.format !== 'fal-tenant-backup' || ![1, 2].includes(backup.manifest.format_version)) return Response.json({ valid: false, errors: ['Formato de backup inválido'] }, { status: 400 });
    const tenantId = destinationTenantId || backup.manifest.tenant_id;
    if (tenantId !== backup.manifest.tenant_id || (role === 'tenant_admin' && actor.tenant_id !== tenantId)) return Response.json({ error: 'TENANT_MISMATCH' }, { status: 403 });
    const errors = [];
    for (const [fileName, expected] of Object.entries(backup.manifest.entities || {})) { const name = fileName.replace('.json', ''); const rows = backup.data[name]; if (!Array.isArray(rows)) { errors.push(`${fileName}: conteúdo ausente`); continue; } if (rows.length !== expected.count) errors.push(`${fileName}: contagem divergente`); if (await sha256(rows) !== expected.sha256) errors.push(`${fileName}: checksum divergente`); if (rows.some((row) => name !== 'Tenant' && row.tenant_id && row.tenant_id !== backup.manifest.tenant_id)) errors.push(`${fileName}: tenant divergente`); }
    const actualGlobal = await sha256({ manifest: { ...backup.manifest, global_sha256: null }, data: backup.data }); if (actualGlobal !== backup.manifest.global_sha256) errors.push('Checksum global divergente');
    errors.push(...validateReferences(backup.data, tenantId));
    const diff = {};
    for (const [name, sourceRows] of Object.entries(backup.data)) { const destinationRows = name === 'Tenant' ? [await base44.asServiceRole.entities.Tenant.get(tenantId)] : await fetchAll(base44.asServiceRole.entities[name], { tenant_id: tenantId }); const destination = new Map(destinationRows.map((row) => [row.id, row])); const result = { creates: 0, updates: 0, conflicts: 0 }; for (const row of sourceRows) { const current = destination.get(row.id); if (!current) result.creates += 1; else if (current.tenant_id && current.tenant_id !== tenantId) result.conflicts += 1; else if (fingerprint(current) !== fingerprint(row)) result.updates += 1; } diff[name] = result; }
    return Response.json({ valid: errors.length === 0, dry_run: true, writes_performed: 0, errors, tenant_id: tenantId, global_sha256: backup.manifest.global_sha256, diff });
  } catch (error) { return Response.json({ valid: false, errors: ['Não foi possível validar o pacote de backup'] }, { status: 500 }); }
});