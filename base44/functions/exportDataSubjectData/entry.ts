import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from '../../shared/accessGovernance.ts';

function publicAuditEntry(item) {
  return { id: item.id, action: item.action, timestamp: item.timestamp, entity_type: item.entity_type || null };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const actor = await base44.auth.me();
    if (!actor) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { operation = 'export' } = await req.json().catch(() => ({}));
    const now = new Date().toISOString();
    if (operation === 'request') {
      await base44.asServiceRole.entities.AuditLog.create({ tenant_id: actor.tenant_id || null, action: 'DATA_SUBJECT_REQUEST', actor_email: actor.email, actor_app_role: actor.app_role || null, target_user_id: actor.id, target_email: actor.email, timestamp: now, details: { request_type: 'administrative_lgpd' } });
      return Response.json({ success: true, requested_at: now, message: 'Solicitação LGPD registrada para tratamento administrativo.' });
    }
    const profiles = await fetchAll(base44.asServiceRole.entities.PendingUserAccessProfile, { email: actor.email.toLowerCase() });
    const userData = { id: actor.id, full_name: actor.full_name || null, email: actor.email, app_role: actor.app_role || null, tenant_id: actor.tenant_id || null, client_id: actor.client_id || null, phone: actor.phone || null, avatar_url: actor.avatar_url || null, created_date: actor.created_date || null, updated_date: actor.updated_date || null };
    const actorLogs = await fetchAll(base44.asServiceRole.entities.AuditLog, { actor_email: actor.email });
    const targetLogs = await fetchAll(base44.asServiceRole.entities.AuditLog, { target_email: actor.email });
    const auditHistory = [...new Map([...actorLogs, ...targetLogs].map((item) => [item.id, publicAuditEntry(item)])).values()].sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
    await base44.asServiceRole.entities.AuditLog.create({ tenant_id: actor.tenant_id || null, action: 'DATA_SUBJECT_EXPORT', actor_email: actor.email, actor_app_role: actor.app_role || null, target_user_id: actor.id, target_email: actor.email, timestamp: now, details: { retention_notice: 'Histórico de auditoria sujeito à retenção obrigatória.' } });
    return Response.json({ format: 'fal-data-subject-export', exported_at: now, retention_notice: 'Registros de auditoria podem ser retidos por obrigação legal, de segurança e contratual.', data: { user: userData, pending_access_profiles: profiles.map((item) => ({ id: item.id, app_role: item.app_role, tenant_id: item.tenant_id || null, status: item.status, applied_at: item.applied_at || null })), audit_history: auditHistory } });
  } catch (error) {
    return Response.json({ error: 'Não foi possível exportar os dados do titular.' }, { status: 500 });
  }
});