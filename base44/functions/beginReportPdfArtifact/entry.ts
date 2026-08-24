import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
function assertCanWrite(role) { if (!WRITE_ROLES.has(role)) throw Object.assign(new Error('Forbidden: write permission required'), { status: 403 }); }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const role = user.app_role || (user.role === 'admin' ? 'hq_admin' : null);
    assertCanWrite(role);
    const { report_version_id } = await req.json();
    if (!report_version_id) return Response.json({ error: 'report_version_id is required' }, { status: 400 });
    const version = await base44.asServiceRole.entities.AssessmentReportVersion.get(report_version_id);
    if (!version) return Response.json({ error: 'Report version not found' }, { status: 404 });
    if (role !== 'hq_admin' && version.tenant_id !== user.tenant_id) return Response.json({ error: 'Forbidden: tenant mismatch' }, { status: 403 });
    if (!['generated', 'active'].includes(version.status)) return Response.json({ error: 'REPORT_VERSION_NOT_GENERATABLE' }, { status: 409 });
    if (version.pdf_status === 'generated' && version.pdf_file_url && version.pdf_checksum && version.pdf_generator_version === 'FAL-PDF-2.46') {
      return Response.json({ reused: true, report_version: version });
    }
    if (version.pdf_status === 'pending') return Response.json({ error: 'PDF_OPERATION_IN_PROGRESS' }, { status: 409 });
    const operationId = crypto.randomUUID();
    const pending = await base44.asServiceRole.entities.AssessmentReportVersion.update(version.id, {
      pdf_status: 'pending', pdf_operation_id: operationId, pdf_started_at: new Date().toISOString(), pdf_started_by: user.email, pdf_error: null,
    });
    const confirmed = await base44.asServiceRole.entities.AssessmentReportVersion.get(version.id);
    if (confirmed.pdf_status !== 'pending' || confirmed.pdf_operation_id !== operationId) throw new Error('PDF_BEGIN_CONFIRMATION_FAILED');
    return Response.json({ reused: false, operation_id: operationId, report_version: pending });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
});