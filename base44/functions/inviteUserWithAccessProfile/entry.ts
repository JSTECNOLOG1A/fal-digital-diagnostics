/**
 * inviteUserWithAccessProfile
 * =====================================================================
 * HQ-only. Invites a user AND creates a PendingUserAccessProfile.
 *
 * Flow:
 *   auth.me → validate HQ → validate profile → inviteUser → create Pending → return
 *
 * The pending profile is applied later by applyPendingUserAccessProfile
 * when the invited user first logs in.
 *
 * Payload: { email, app_role, tenant_id }
 * Response: { invite_sent: true, profile_pending: { id, status } }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);

function resolveAppRole(user: any): string | null {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

function expectedBuiltInRole(appRole: string): string {
  return appRole === 'hq_admin' ? 'admin' : 'user';
}

async function loadActiveTenant(base44: any, tenantId: string) {
  const tenant = await base44.asServiceRole.entities.Tenant.get(tenantId).catch(() => null);
  if (!tenant) {
    throw Object.assign(new Error('Tenant não encontrado'), { status: 404 });
  }
  if (tenant.active === false) {
    throw Object.assign(new Error('Tenant inativo — convite não permitido'), { status: 400 });
  }
  return tenant;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const actor = await base44.auth.me();
    if (!actor) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const actorAppRole = resolveAppRole(actor);
    if (!['hq_admin', 'tenant_admin'].includes(actorAppRole || '')) {
      return Response.json({ error: 'Forbidden: admin role required' }, { status: 403 });
    }

    const body = await req.json();
    const { email, app_role, tenant_id } = body;

    if (!email) return Response.json({ error: 'email é obrigatório' }, { status: 400 });
    if (!app_role || !VALID_APP_ROLES.has(app_role)) {
      return Response.json({ error: 'app_role inválido' }, { status: 400 });
    }
    if (app_role === 'hq_admin' && tenant_id) {
      return Response.json({ error: 'hq_admin deve ter tenant_id = null' }, { status: 400 });
    }
    if (app_role !== 'hq_admin' && !tenant_id) {
      return Response.json({ error: `${app_role} requer tenant_id` }, { status: 400 });
    }
    if (actorAppRole === 'tenant_admin' && (!['consultant', 'client_viewer'].includes(app_role) || tenant_id !== actor.tenant_id)) {
      return Response.json({ error: 'tenant_admin só pode convidar consultant ou client_viewer do próprio tenant' }, { status: 403 });
    }

    const expectedRole = expectedBuiltInRole(app_role);

    // ── 0. Validate target tenant exists and is active (before creating pending or inviting) ──
    if (app_role !== 'hq_admin') {
      try {
        await loadActiveTenant(base44, tenant_id);
      } catch (error: any) {
        return Response.json({ error: error.message }, { status: error.status || 400 });
      }
    }

    // ── 1. Create or update PendingUserAccessProfile FIRST ──
    // (if invite fails later, pending is marked as error — no orphan invites)
    const existing = await base44.asServiceRole.entities.PendingUserAccessProfile.filter({
      email: email.toLowerCase(),
      status: 'pending',
    });

    let pending;
    if (existing && existing.length > 0) {
      pending = await base44.asServiceRole.entities.PendingUserAccessProfile.update(existing[0].id, {
        app_role,
        tenant_id: app_role === 'hq_admin' ? null : tenant_id,
        expected_built_in_role: expectedRole,
        error_message: null,
      });
    } else {
      pending = await base44.asServiceRole.entities.PendingUserAccessProfile.create({
        email: email.toLowerCase(),
        app_role,
        tenant_id: app_role === 'hq_admin' ? null : tenant_id,
        expected_built_in_role: expectedRole,
        status: 'pending',
        created_by_user_id: actor.id,
        created_by_email: actor.email,
      });
    }

    // ── 2. Send Base44 invite with correct technical role ──
    // If invite fails, mark pending as error — no orphan pending without invite
    try {
      await base44.users.inviteUser(email, expectedRole);
    } catch (inviteErr) {
      await base44.asServiceRole.entities.PendingUserAccessProfile.update(pending.id, {
        status: 'error',
        error_message: `invite_failed: ${inviteErr.message}`,
      });
      return Response.json({
        error: 'Não foi possível concluir o convite',
        detail: inviteErr.message,
      }, { status: 500 });
    }

    // ── 3. AuditLog ──
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        tenant_id: null,
        action: 'INVITE_USER_WITH_ACCESS_PROFILE',
        actor_email: actor.email,
        actor_app_role: actorAppRole,
        target_email: email,
        invited_app_role: app_role,
        invited_tenant_id: app_role === 'hq_admin' ? null : tenant_id,
        pending_id: pending.id,
        timestamp: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn('[inviteUserWithAccessProfile] AuditLog failed:', auditErr?.message);
    }

    return Response.json({
      invite_sent: true,
      profile_pending: {
        id: pending.id,
        email: pending.email,
        app_role: pending.app_role,
        tenant_id: pending.tenant_id,
        status: pending.status,
      },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});