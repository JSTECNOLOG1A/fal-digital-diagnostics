/**
 * assignUserAccessProfile
 * =====================================================================
 * Assigns app_role and tenant_id to a user.
 *
 * Actors: hq_admin (global) or tenant_admin (own tenant only).
 *
 * Contract:
 *   - Never calls asServiceRole.users.updateRole (API does not exist)
 *   - Validates built-in role compatibility BEFORE update
 *   - Updates only app_role and tenant_id (custom fields)
 *   - Re-reads user after update and verifies postcondition
 *   - Returns the real re-read state, not locally computed values
 *
 * Payload: { user_id, app_role, tenant_id }
 * Response: { success, user: { id, email, role, app_role, tenant_id } }
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

function assertBuiltInRoleCompatible(targetUser: any, desiredAppRole: string) {
  const expected = expectedBuiltInRole(desiredAppRole);
  if (targetUser?.role !== expected) {
    throw Object.assign(
      new Error(
        `Built-in role incompatível. Esperado ${expected}, encontrado ${targetUser?.role}. ` +
        'Altere o papel técnico no Dashboard do Base44 antes de aplicar o app_role.'
      ),
      {
        status: 409,
        code: 'BUILT_IN_ROLE_MISMATCH',
        expected_role: expected,
        actual_role: targetUser?.role || null,
      }
    );
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const actor = await base44.auth.me();
    if (!actor) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // ── 1. Resolve actor app_role ──
    const actorAppRole = resolveAppRole(actor);
    if (!actorAppRole) {
      return Response.json({ error: 'Forbidden: actor sem app_role' }, { status: 403 });
    }

    // ── 2. Guard: only hq_admin or tenant_admin can assign ──
    if (actorAppRole !== 'hq_admin' && actorAppRole !== 'tenant_admin') {
      return Response.json({ error: 'Forbidden: admin role required' }, { status: 403 });
    }

    const body = await req.json();
    const { user_id, app_role: desiredAppRole, tenant_id: desiredTenantId } = body;

    // ── 3. Validate inputs ──
    if (!user_id) return Response.json({ error: 'user_id é obrigatório' }, { status: 400 });
    if (!desiredAppRole || !VALID_APP_ROLES.has(desiredAppRole)) {
      return Response.json({ error: 'app_role inválido' }, { status: 400 });
    }

    // ── 4. Load target user BEFORE scope authorization ──
    const targetUser = await base44.asServiceRole.entities.User.get(user_id);
    if (!targetUser) {
      return Response.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // ── 5. Prohibit self-assignment ──
    if (targetUser.id === actor.id) {
      return Response.json({ error: 'Não é permitido alterar o próprio perfil' }, { status: 403 });
    }

    // ── 6. Validate desired app_role / tenant ──
    if (desiredAppRole === 'hq_admin' && desiredTenantId) {
      return Response.json({ error: 'hq_admin deve ter tenant_id = null' }, { status: 400 });
    }
    if (desiredAppRole !== 'hq_admin' && !desiredTenantId) {
      return Response.json({ error: `${desiredAppRole} requer tenant_id` }, { status: 400 });
    }

    // ── 6b. Validate target tenant exists and is active ──
    if (desiredAppRole !== 'hq_admin' && desiredTenantId) {
      const targetTenant = await base44.asServiceRole.entities.Tenant.get(desiredTenantId).catch(() => null);
      if (!targetTenant) {
        return Response.json({ error: 'Tenant não encontrado' }, { status: 404 });
      }
      if (targetTenant.active === false) {
        return Response.json({ error: 'Tenant inativo — não é possível vincular usuário' }, { status: 400 });
      }
    }

    // ── 7. tenant_admin scope rules ──
    if (actorAppRole === 'tenant_admin') {
      if (targetUser.role === 'admin') {
        return Response.json({ error: 'tenant_admin não pode alterar usuário técnico admin' }, { status: 403 });
      }
      if (targetUser.app_role === 'hq_admin') {
        return Response.json({ error: 'tenant_admin não pode alterar HQ Admin' }, { status: 403 });
      }
      if (targetUser.tenant_id !== actor.tenant_id) {
        return Response.json({ error: 'Forbidden: target user outside tenant scope' }, { status: 403 });
      }
      if (!['consultant', 'client_viewer'].includes(desiredAppRole)) {
        return Response.json({ error: 'tenant_admin só pode atribuir consultant ou client_viewer' }, { status: 403 });
      }
      if (desiredTenantId !== actor.tenant_id) {
        return Response.json({ error: 'Forbidden: tenant mismatch' }, { status: 403 });
      }
    }

    // ── 8. Validate built-in role compatibility ──
    try {
      assertBuiltInRoleCompatible(targetUser, desiredAppRole);
    } catch (error: any) {
      return Response.json(
        {
          error: error.message,
          code: error.code,
          expected_role: error.expected_role,
          actual_role: error.actual_role,
        },
        { status: error.status || 409 }
      );
    }

    // ── 9. Compute expected tenant ──
    const expectedTenantId = desiredAppRole === 'hq_admin' ? null : desiredTenantId;

    // ── 10. Update ONLY custom fields ──
    await base44.asServiceRole.entities.User.update(targetUser.id, {
      app_role: desiredAppRole,
      tenant_id: expectedTenantId,
    });

    // ── 11. Re-read user ──
    const updatedUser = await base44.asServiceRole.entities.User.get(targetUser.id);

    // ── 12. Verify postcondition ──
    if (
      updatedUser.app_role !== desiredAppRole ||
      updatedUser.tenant_id !== expectedTenantId ||
      updatedUser.role !== expectedBuiltInRole(desiredAppRole)
    ) {
      return Response.json(
        {
          error: 'Perfil final diverge do estado esperado',
          code: 'PROFILE_POSTCONDITION_FAILED',
          expected: { app_role: desiredAppRole, tenant_id: expectedTenantId, role: expectedBuiltInRole(desiredAppRole) },
          actual: { app_role: updatedUser.app_role, tenant_id: updatedUser.tenant_id, role: updatedUser.role },
        },
        { status: 500 }
      );
    }

    // ── 13. AuditLog ──
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        tenant_id: actor.tenant_id || null,
        action: 'ASSIGN_USER_ACCESS_PROFILE',
        actor_email: actor.email,
        actor_app_role: actorAppRole,
        target_user_id: targetUser.id,
        target_email: targetUser.email,
        previous_app_role: targetUser.app_role || null,
        new_app_role: desiredAppRole,
        previous_tenant_id: targetUser.tenant_id || null,
        new_tenant_id: expectedTenantId,
        timestamp: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn('[assignUserAccessProfile] AuditLog creation failed:', auditErr?.message);
    }

    // ── 14. Return real re-read state ──
    return Response.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        app_role: updatedUser.app_role,
        tenant_id: updatedUser.tenant_id,
      },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});