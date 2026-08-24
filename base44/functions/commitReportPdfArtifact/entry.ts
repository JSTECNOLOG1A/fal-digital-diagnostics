import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
function assertCanWrite(role) { if (!WRITE_ROLES.has(role)) throw Object.assign(new Error('Forbidden: write permission required'), { status: 403 }); }
const isChecksum = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const isBase44FileUrl = (value) => typeof value === 'string' && /^https:\/\/(?:[a-z0-9-]+\.)?base44\./i.test(value);
const isBase44UploadIdentifier = (value, fileUrl) =>
  typeof value === 'string'
  && value.length >= 3
  && (
    !/^https:\/\//.test(value)
    || (
      value === fileUrl
      && isBase44FileUrl(value)
    )
  );

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const role = user.app_role || (user.role === 'admin' ? 'hq_admin' : null);
    assertCanWrite(role);
    const body = await req.json();
    if (!body.report_version_id) return Response.json({ error: 'report_version_id is required' }, { status: 400 });
    const version = await base44.asServiceRole.entities.AssessmentReportVersion.get(body.report_version_id);
    if (!version) return Response.json({ error: 'Report version not found' }, { status: 404 });
    if (role !== 'hq_admin' && version.tenant_id !== user.tenant_id) return Response.json({ error: 'Forbidden: tenant mismatch' }, { status: 403 });
    if (body.pdf_status === 'failed') {
      if (version.pdf_status !== 'pending' || body.pdf_operation_id !== version.pdf_operation_id) return Response.json({ error: 'PDF_OPERATION_MISMATCH' }, { status: 409 });
      return Response.json({ report_version: await base44.asServiceRole.entities.AssessmentReportVersion.update(version.id, { pdf_status: 'failed', pdf_error: String(body.pdf_error || 'PDF generation failed') }) });
    }
    if (version.pdf_status !== 'pending' || body.pdf_operation_id !== version.pdf_operation_id) return Response.json({ error: 'PDF_OPERATION_MISMATCH' }, { status: 409 });
    if (!['generated', 'active'].includes(version.status)) return Response.json({ error: 'REPORT_VERSION_NOT_GENERATABLE' }, { status: 409 });
    if (!isBase44UploadIdentifier(body.pdf_upload_identifier, body.pdf_file_url) || !isBase44FileUrl(body.pdf_file_url) || body.pdf_storage_provider !== 'base44') return Response.json({ error: 'PDF_STORAGE_REFERENCE_INVALID' }, { status: 400 });
    if (body.pdf_storage_key && body.pdf_storage_key === body.pdf_file_url) return Response.json({ error: 'PDF_STORAGE_KEY_MUST_NOT_DUPLICATE_URL' }, { status: 400 });
    if (!Number.isInteger(Number(body.pdf_file_size)) || Number(body.pdf_file_size) < 1 || !Number.isInteger(Number(body.pdf_page_count)) || Number(body.pdf_page_count) < 1 || !isChecksum(body.pdf_checksum)) return Response.json({ error: 'PDF_ARTIFACT_METADATA_INVALID' }, { status: 400 });
    if (!isChecksum(body.payload_checksum) || body.payload_checksum !== version.payload_checksum) return Response.json({ error: 'PAYLOAD_CHECKSUM_MISMATCH' }, { status: 409 });
    const updated = await base44.asServiceRole.entities.AssessmentReportVersion.update(version.id, { pdf_status: 'generated', pdf_file_url: body.pdf_file_url, pdf_upload_identifier: body.pdf_upload_identifier, pdf_checksum: body.pdf_checksum.toLowerCase(), pdf_page_count: Number(body.pdf_page_count), pdf_file_size: Number(body.pdf_file_size), pdf_storage_provider: 'base44', pdf_storage_key: body.pdf_storage_key || null, pdf_generator_version: 'FAL-PDF-2.46', pdf_generated_at: new Date().toISOString(), pdf_error: null });
    const confirmed = await base44.asServiceRole.entities.AssessmentReportVersion.get(version.id);
    if (confirmed.pdf_checksum !== updated.pdf_checksum || confirmed.pdf_upload_identifier !== body.pdf_upload_identifier) throw new Error('PDF_ARTIFACT_CONFIRMATION_FAILED');
    return Response.json({ report_version: confirmed });
  } catch (error) { return Response.json({ error: error.message }, { status: error.status || 500 }); }
});