/**
 * applyPendingUserAccessProfile
 * =====================================================================
 * Invoked by the authenticated user after their first login.
 * Applies the pending access profile to the caller's own account.
 *
 * Flow:
 *   auth.me → find pending by own email → validate status → validate built-in role
 *   → update own app_role/tenant_id via service role → re-read → mark applied
 *
 * Security:
 *   - Can ONLY apply profiles matching the caller's own email
 *   - Validates built-in role compatibility before applying
 *   - Re-reads user after update to verify postcondition
 *   - Marks pending as 'applied' only after verified
 *
 * Payload: {} (no params — uses caller's own email from auth.me)
 * Response: { success, applied: { app_role, tenant_id, role } }
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // ── 1. Find pending profile by caller's own email ──
    const pendingList = await base44.asServiceRole.entities.PendingUserAccessProfile.filter({
      email: user.email?.toLowerCase(),
      status: 'pending',
    });

    if (!pendingList || pendingList.length === 0) {
      return Response.json({
        success: false,
        message: 'Nenhum perfil pendente encontrado para este email',
      }, { status: 404 });
    }

    const pending = pendingList[0];

    // ── 2. Validate built-in role compatibility ──
    const expectedRole = expectedBuiltInRole(pending.app_role);
    if (user.role !== expectedRole) {
      // Mark pending as error
      await base44.asServiceRole.entities.PendingUserAccessProfile.update(pending.id, {
        status: 'error',
        error_message: `Built-in role incompatível. Esperado ${expectedRole}, encontrado ${user.role}.`,
      });
      return Response.json({
        error: `Built-in role incompatível. Esperado ${expectedRole}, encontrado ${user.role}. Peça ao HQ para reenviar o convite com o papel técnico correto.`,
        code: 'BUILT_IN_ROLE_MISMATCH',
        expected_role: expectedRole,
        actual_role: user.role,
      }, { status: 409 });
    }

    // ── 2b. Validate target tenant from pending (before updating User) ──
    if (pending.app_role !== 'hq_admin') {
      const targetTenant = await base44.asServiceRole.entities.Tenant.get(pending.tenant_id).catch(() => null);
      if (!targetTenant) {
        await base44.asServiceRole.entities.PendingUserAccessProfile.update(pending.id, {
          status: 'error',
          error_message: 'Tenant do perfil pendente não encontrado',
        });
        return Response.json({
          error: 'Tenant do perfil pendente não encontrado',
          code: 'PENDING_TENANT_NOT_FOUND',
        }, { status: 404 });
      }
      if (targetTenant.active === false) {
        await base44.asServiceRole.entities.PendingUserAccessProfile.update(pending.id, {
          status: 'error',
          error_message: 'Tenant do perfil pendente está inativo',
        });
        return Response.json({
          error: 'Tenant do perfil pendente está inativo',
          code: 'PENDING_TENANT_INACTIVE',
        }, { status: 409 });
      }
    }

    // ── 3. Update own app_role/tenant_id via service role ──
    const expectedTenantId = pending.app_role === 'hq_admin' ? null : pending.tenant_id;

    await base44.asServiceRole.entities.User.update(user.id, {
      app_role: pending.app_role,
      tenant_id: expectedTenantId,
    });

    // ── 4. Re-read user ──
    const updatedUser = await base44.asServiceRole.entities.User.get(user.id);

    // ── 5. Verify postcondition ──
    if (
      updatedUser.app_role !== pending.app_role ||
      updatedUser.tenant_id !== expectedTenantId ||
      updatedUser.role !== expectedRole
    ) {
      await base44.asServiceRole.entities.PendingUserAccessProfile.update(pending.id, {
        status: 'error',
        error_message: 'Perfil final diverge do estado esperado',
      });
      return Response.json({
        error: 'Perfil final diverge do estado esperado',
        code: 'PROFILE_POSTCONDITION_FAILED',
      }, { status: 500 });
    }

    // ── 6. Mark pending as applied ──
    await base44.asServiceRole.entities.PendingUserAccessProfile.update(pending.id, {
      status: 'applied',
      applied_user_id: updatedUser.id,
      applied_at: new Date().toISOString(),
    });

    // ── 7. AuditLog ──
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        tenant_id: expectedTenantId,
        action: 'APPLY_PENDING_USER_ACCESS_PROFILE',
        actor_email: updatedUser.email,
        actor_app_role: pending.app_role,
        pending_id: pending.id,
        applied_app_role: pending.app_role,
        applied_tenant_id: expectedTenantId,
        timestamp: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn('[applyPending] AuditLog failed:', auditErr?.message);
    }

    return Response.json({
      success: true,
      applied: {
        app_role: updatedUser.app_role,
        tenant_id: updatedUser.tenant_id,
        role: updatedUser.role,
      },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});