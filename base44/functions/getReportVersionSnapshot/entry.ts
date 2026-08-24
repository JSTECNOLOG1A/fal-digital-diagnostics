/**
 * getReportVersionSnapshot
 * Retorna o payload_snapshot de uma AssessmentReportVersion de forma segura.
 * 
 * Guards:
 * - Usuário autenticado
 * - version.tenant_id === user.tenant_id (salvo HQ)
 * - Versão deve existir e ter payload_snapshot
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { report_version_id } = body;
    if (!report_version_id) return Response.json({ error: 'report_version_id é obrigatório' }, { status: 400 });

    const version = await base44.asServiceRole.entities.AssessmentReportVersion.get(report_version_id);
    if (!version) return Response.json({ error: 'Versão de relatório não encontrada' }, { status: 404 });

    // Guard de tenant
    if (!isHQ && version.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden: relatório pertence a outro tenant' }, { status: 403 });
    }

    if (!version.payload_snapshot) {
      return Response.json({
        error: 'Este relatório não possui payload_snapshot. Pode ter sido gerado antes do versionamento. Gere uma nova versão.'
      }, { status: 422 });
    }

    return Response.json({
      payload_snapshot: version.payload_snapshot,
      report_metadata: {
        id: version.id,
        report_code: version.report_code,
        report_title: version.report_title,
        report_type: version.report_type,
        report_version_number: version.report_version_number,
        generated_at: version.generated_at,
        generated_by: version.generated_by,
        mark_as_official: version.mark_as_official,
        status: version.status,
        payload_checksum: version.payload_checksum,
        pdf_status: version.pdf_status,
        pdf_file_url: version.pdf_file_url,
      },
    });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});