import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user.app_role)) return user.app_role;
  if (user.role === 'admin') return 'hq_admin';
  return null;
}
function assertCanWrite(effectiveRole) {
  if (!WRITE_ROLES.has(effectiveRole)) throw Object.assign(new Error('Forbidden: write permission required'), { status: 403 });
}
async function readAll(entity, query) {
  const rows = []; let cursor = null;
  while (true) {
    const page = await entity.filter(cursor ? { ...query, id: { $gt: cursor } } : query, 'id', 500);
    rows.push(...page);
    if (page.length < 500) return rows;
    cursor = page[page.length - 1].id;
  }
}
function archiveState(version) {
  return { status: version.status, mark_as_official: version.mark_as_official, archived_at: version.archived_at || null, archived_by: version.archived_by || null, archive_reason: version.archive_reason || null };
}
function restoreArchiveState(entity, version) {
  return entity.update(version.id, archiveState(version));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const effectiveRole = resolveAppRole(user);
    assertCanWrite(effectiveRole);
    const { report_version_id, replacement_report_version_id, reason } = await req.json();
    const version = await base44.asServiceRole.entities.AssessmentReportVersion.get(report_version_id);
    if (!version) return Response.json({ error: 'Versão não encontrada' }, { status: 404 });
    if (effectiveRole !== 'hq_admin' && version.tenant_id !== user.tenant_id) return Response.json({ error: 'Forbidden: relatório pertence a outro tenant' }, { status: 403 });
    if (version.status === 'archived') return Response.json({ error: 'Relatório já está arquivado' }, { status: 400 });
    if (version.pdf_status === 'pending') return Response.json({ error: 'REPORT_PDF_OPERATION_IN_PROGRESS' }, { status: 409 });
    const versions = await readAll(base44.asServiceRole.entities.AssessmentReportVersion, { tenant_id: version.tenant_id, assessment_id: version.assessment_id, report_type: version.report_type });
    const activeOfficials = versions.filter((item) => item.mark_as_official && ['generated', 'active'].includes(item.status));
    if (version.mark_as_official && activeOfficials.length === 1 && !replacement_report_version_id) return Response.json({ error: 'OFFICIAL_REPORT_REPLACEMENT_REQUIRED' }, { status: 409 });
    const replacement = replacement_report_version_id ? versions.find((item) => item.id === replacement_report_version_id && ['generated', 'active'].includes(item.status)) : null;
    if (replacement_report_version_id && (!replacement || replacement.pdf_status === 'pending')) return Response.json({ error: 'OFFICIAL_REPORT_REPLACEMENT_INVALID' }, { status: 409 });
    const previousVersion = archiveState(version);
    const previousReplacement = replacement ? archiveState(replacement) : null;
    try {
      if (replacement) await base44.asServiceRole.entities.AssessmentReportVersion.update(replacement.id, { mark_as_official: true, status: 'active' });
      await base44.asServiceRole.entities.AssessmentReportVersion.update(version.id, { mark_as_official: false, status: 'archived', archived_at: new Date().toISOString(), archived_by: user.email, archive_reason: reason || null });
      const confirmed = await readAll(base44.asServiceRole.entities.AssessmentReportVersion, { tenant_id: version.tenant_id, assessment_id: version.assessment_id, report_type: version.report_type });
      const officialCount = confirmed.filter((item) => item.mark_as_official && ['generated', 'active'].includes(item.status)).length;
      if ((replacement && officialCount !== 1) || (!replacement && version.mark_as_official && officialCount !== 0)) throw new Error('OFFICIAL_ARCHIVE_CONFIRMATION_FAILED');
      return Response.json({ report_version: await base44.asServiceRole.entities.AssessmentReportVersion.get(version.id) });
    } catch (error) {
     await base44.asServiceRole.entities.AssessmentReportVersion.update(version.id, previousVersion);
     if (previousReplacement) await base44.asServiceRole.entities.AssessmentReportVersion.update(replacement.id, previousReplacement);
     throw error;
    }
  } catch (error) { return Response.json({ error: error.message }, { status: error.status || 500 }); }
});