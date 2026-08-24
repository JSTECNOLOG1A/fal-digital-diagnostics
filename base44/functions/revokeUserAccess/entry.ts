import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { canManageAccess, resolveAppRole } from '../../shared/accessGovernance.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req); const actor = await base44.auth.me();
    if (!actor) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { user_id: userId, reason } = await req.json();
    if (!userId || !String(reason || '').trim()) return Response.json({ error: 'user_id e reason são obrigatórios' }, { status: 400 });
    const target = await base44.asServiceRole.entities.User.get(userId).catch(() => null);
    if (!target) return Response.json({ error: 'Usuário não encontrado' }, { status: 404 });
    if (!canManageAccess(actor, target)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const now = new Date().toISOString(); const previousTenantId = target.tenant_id || null;
    await base44.asServiceRole.entities.User.update(target.id, { app_role: null, tenant_id: null, access_status: 'revoked', revoked_at: now, revoked_by: actor.id, access_revocation_reason: String(reason).trim() });
    const pendings = await base44.asServiceRole.entities.PendingUserAccessProfile.filter({ email: target.email.toLowerCase(), status: 'pending' }, '-updated_date', 20);
    for (const pending of pendings) await base44.asServiceRole.entities.PendingUserAccessProfile.update(pending.id, { status: 'cancelled', error_message: 'Acesso revogado pelo administrador' });
    await base44.asServiceRole.entities.AuditLog.create({ tenant_id: previousTenantId, action: 'REVOKE_USER_ACCESS', actor_email: actor.email, actor_app_role: resolveAppRole(actor), target_user_id: target.id, target_email: target.email, previous_app_role: target.app_role || null, previous_tenant_id: previousTenantId, new_app_role: null, new_tenant_id: null, timestamp: now, details: { reason: String(reason).trim(), pending_profiles_cancelled: pendings.length } });
    return Response.json({ success: true, user_id: target.id, access_status: 'revoked', pending_profiles_cancelled: pendings.length });
  } catch (error) { return Response.json({ error: 'Não foi possível revogar o acesso.' }, { status: 500 }); }
});