import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveAppRole, validAppRoles } from '../../shared/accessGovernance.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req); const actor = await base44.auth.me();
    if (!actor) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const actorRole = resolveAppRole(actor); const { email } = await req.json(); const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) return Response.json({ error: 'email é obrigatório' }, { status: 400 });
    if (!['hq_admin', 'tenant_admin'].includes(actorRole || '')) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const profiles = await base44.asServiceRole.entities.PendingUserAccessProfile.filter({ email: normalizedEmail, status: 'pending' }, '-updated_date', 2);
    const pending = profiles[0];
    if (!pending) return Response.json({ error: 'Convite pendente não encontrado' }, { status: 404 });
    if (!validAppRoles.has(pending.app_role) || (actorRole === 'tenant_admin' && (pending.tenant_id !== actor.tenant_id || !['consultant', 'client_viewer'].includes(pending.app_role)))) return Response.json({ error: 'Forbidden' }, { status: 403 });
    await base44.users.inviteUser(normalizedEmail, pending.expected_built_in_role);
    const updated = await base44.asServiceRole.entities.PendingUserAccessProfile.update(pending.id, { error_message: null });
    await base44.asServiceRole.entities.AuditLog.create({ tenant_id: pending.tenant_id || null, action: 'RESEND_USER_INVITATION', actor_email: actor.email, actor_app_role: actorRole, target_email: normalizedEmail, pending_id: pending.id, timestamp: new Date().toISOString() });
    return Response.json({ success: true, profile_pending: { id: updated.id, email: updated.email, status: updated.status } });
  } catch (error) { return Response.json({ error: 'Não foi possível reenviar o convite.' }, { status: 500 }); }
});