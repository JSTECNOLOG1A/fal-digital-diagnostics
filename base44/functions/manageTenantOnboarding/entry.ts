import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
const steps = ['tenant', 'group', 'company', 'unit', 'diagnostic', 'complete'];
const roleOf = (user) => user?.app_role || (user?.role === 'admin' ? 'hq_admin' : null);
const unique = (values) => [...new Set(values)];

async function findInitialStructure(base44, tenantId) {
  const groups = await base44.asServiceRole.entities.Group.filter({ tenant_id: tenantId, is_archived: { $ne: true } }, 'created_date', 1);
  const group = groups[0] || null;
  const companies = group ? await base44.asServiceRole.entities.Company.filter({ tenant_id: tenantId, group_id: group.id }, 'created_date', 1) : [];
  const company = companies[0] || null;
  const units = company ? await base44.asServiceRole.entities.OperationalUnit.filter({ tenant_id: tenantId, company_id: company.id }, 'created_date', 1) : [];
  const assessments = group ? await base44.asServiceRole.entities.Assessment.filter({ tenant_id: tenantId, group_id: group.id }, '-updated_date', 1) : [];
  return { group, company, unit: units[0] || null, assessment: assessments[0] || null };
}

async function resolveMethodVersion(base44, tenant, payload) {
  if (payload.method_version_id || tenant.active_method_version_id) return payload.method_version_id || tenant.active_method_version_id;
  const published = await base44.asServiceRole.entities.MethodVersion.filter({ status: 'published' }, '-created_date', 1);
  return published[0]?.id || null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const actor = await base44.auth.me();
    if (!actor) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const { tenant_id: tenantId, operation, payload = {} } = body;
    const appRole = roleOf(actor);
    if (!WRITE_ROLES.has(appRole)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (!tenantId || (appRole !== 'hq_admin' && actor.tenant_id !== tenantId)) return Response.json({ error: 'Tenant access denied' }, { status: 403 });
    const tenant = await base44.asServiceRole.entities.Tenant.get(tenantId).catch(() => null);
    if (!tenant || tenant.active === false) return Response.json({ error: 'Tenant inexistente ou inativo' }, { status: 404 });
    const initial = await findInitialStructure(base44, tenantId);
    const existing = await base44.asServiceRole.entities.OnboardingProgress.filter({ tenant_id: tenantId, user_id: actor.id, onboarding_key: 'initial-tenant-setup' }, '-updated_date', 1);
    let progress = existing[0];
    if (!progress) {
      const configured = initial.group && initial.company && initial.assessment;
      progress = await base44.asServiceRole.entities.OnboardingProgress.create({ tenant_id: tenantId, user_id: actor.id, onboarding_key: 'initial-tenant-setup', group_id: initial.group?.id, company_id: initial.company?.id, unit_id: initial.unit?.id, current_step: configured ? 'complete' : initial.company ? 'unit' : initial.group ? 'company' : 'tenant', completed_steps: configured ? steps : unique(['tenant', ...(initial.group ? ['group'] : []), ...(initial.company ? ['company'] : []), ...(initial.unit ? ['unit'] : [])]), status: configured ? 'completed' : 'active', started_at: new Date().toISOString(), completed_at: configured ? new Date().toISOString() : null, version: 2 });
    }
    if (operation === 'get') return Response.json({ onboarding: progress, configured: progress.status === 'completed', assessment_id: initial.assessment?.id || null });
    if (progress.status === 'completed') return Response.json({ error: 'Tenant já configurado', onboarding: progress, assessment_id: initial.assessment?.id || null }, { status: 409 });
    let patch = {};
    let assessmentId = initial.assessment?.id || null;
    if (operation === 'create_group') {
      if (!payload.name?.trim()) return Response.json({ error: 'Nome do grupo é obrigatório' }, { status: 400 });
      const found = await base44.asServiceRole.entities.Group.filter({ tenant_id: tenantId, name: payload.name.trim() }, 'created_date', 1);
      const group = found[0] || await base44.asServiceRole.entities.Group.create({ tenant_id: tenantId, name: payload.name.trim() });
      patch = { group_id: group.id, current_step: 'company', completed_steps: unique([...progress.completed_steps, 'tenant', 'group']) };
    } else if (operation === 'create_company') {
      const groupId = progress.group_id || initial.group?.id;
      if (!groupId || !payload.name?.trim() || !payload.tax_id?.trim()) return Response.json({ error: 'Grupo, nome e CNPJ são obrigatórios' }, { status: 400 });
      const found = await base44.asServiceRole.entities.Company.filter({ tenant_id: tenantId, tax_id: payload.tax_id.trim() }, 'created_date', 1);
      const company = found[0] || await base44.asServiceRole.entities.Company.create({ tenant_id: tenantId, group_id: groupId, name: payload.name.trim(), tax_id: payload.tax_id.trim() });
      patch = { group_id: groupId, company_id: company.id, current_step: 'unit', completed_steps: unique([...progress.completed_steps, 'tenant', 'group', 'company']) };
    } else if (operation === 'create_unit') {
      const companyId = progress.company_id || initial.company?.id;
      if (!companyId || !payload.name?.trim()) return Response.json({ error: 'Empresa e nome da unidade são obrigatórios' }, { status: 400 });
      const found = await base44.asServiceRole.entities.OperationalUnit.filter({ tenant_id: tenantId, company_id: companyId, name: payload.name.trim() }, 'created_date', 1);
      const unit = found[0] || await base44.asServiceRole.entities.OperationalUnit.create({ tenant_id: tenantId, company_id: companyId, name: payload.name.trim(), unit_type: 'Unidade Operacional', is_active: true });
      patch = { unit_id: unit.id, current_step: 'diagnostic', completed_steps: unique([...progress.completed_steps, 'unit']) };
    } else if (operation === 'skip_unit') {
      if (!(progress.company_id || initial.company?.id)) return Response.json({ error: 'Empresa obrigatória antes de avançar' }, { status: 400 });
      patch = { current_step: 'diagnostic', completed_steps: unique([...progress.completed_steps, 'unit']) };
    } else if (operation === 'create_assessment') {
      const groupId = progress.group_id || initial.group?.id;
      const companyId = progress.company_id || initial.company?.id;
      const methodVersionId = await resolveMethodVersion(base44, tenant, payload);
      if (!groupId || !companyId || !methodVersionId) return Response.json({ error: 'Estrutura inicial e versão do método são obrigatórias para criar o diagnóstico' }, { status: 400 });
      if (payload.responsible_email?.trim()) await base44.functions.invoke('inviteUserWithAccessProfile', { email: payload.responsible_email.trim().toLowerCase(), app_role: 'consultant', tenant_id: tenantId });
      const assessments = await base44.asServiceRole.entities.Assessment.filter({ tenant_id: tenantId, group_id: groupId, target_type: 'group' }, '-updated_date', 1);
      const assessment = assessments[0] || await base44.asServiceRole.entities.Assessment.create({ tenant_id: tenantId, method_version_id: methodVersionId, title: payload.title?.trim() || 'Diagnóstico inicial', display_name: payload.title?.trim() || 'Diagnóstico inicial', assessment_type: 'diagnostico_inicial', assessment_mode: 'single_entity', status: 'draft', target_type: 'group', target_id: groupId, group_id: groupId, company_id: companyId, unit_id: progress.unit_id || null, assigned_to: payload.responsible_email?.trim().toLowerCase() || actor.email });
      assessmentId = assessment.id;
      patch = { current_step: 'complete', completed_steps: unique([...progress.completed_steps, 'diagnostic']), status: 'completed', completed_at: new Date().toISOString() };
    } else return Response.json({ error: 'Operação inválida' }, { status: 400 });
    const updated = await base44.asServiceRole.entities.OnboardingProgress.update(progress.id, patch);
    await base44.asServiceRole.entities.AuditLog.create({ tenant_id: tenantId, user_email: actor.email, action: `ONBOARDING_${operation.toUpperCase()}`, entity_type: 'OnboardingProgress', entity_id: updated.id, details: { group_id: updated.group_id, company_id: updated.company_id, unit_id: updated.unit_id, assessment_id: assessmentId } });
    return Response.json({ onboarding: updated, assessment_id: assessmentId });
  } catch (error) {
    return Response.json({ error: error.message || 'Não foi possível concluir o onboarding.' }, { status: 500 });
  }
});