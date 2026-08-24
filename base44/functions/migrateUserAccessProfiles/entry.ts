/**
 * migrateUserAccessProfiles
 * =====================================================================
 * HQ-only, idempotent migration function for existing users.
 *
 * Contract:
 *   - dry_run is the default (apply !== true → no updates)
 *   - Full preflight before ANY update
 *   - All built-in admins MUST be in the matrix (no inference)
 *   - blockers.length > 0 → HTTP 409, zero updates
 *   - Updates only app_role and tenant_id (never role)
 *   - Re-reads each user after update
 *   - Final report uses re-read values
 *
 * Payload: {
 *   dry_run?: boolean,     // default true
 *   apply?: boolean,       // must be true to write
 *   migration_matrix: [{ email, app_role, tenant_id }]
 * }
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
    const actor = await base44.auth.me();
    if (!actor) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const actorAppRole = resolveAppRole(actor);
    if (actorAppRole !== 'hq_admin') {
      return Response.json({ error: 'Forbidden: hq_admin only' }, { status: 403 });
    }

    const body = await req.json();
    const { migration_matrix, apply } = body;
    const isDryRun = apply !== true;

    if (!Array.isArray(migration_matrix)) {
      return Response.json({ error: 'migration_matrix deve ser um array' }, { status: 400 });
    }

    // ── 1. Validate matrix entries ──
    for (const entry of migration_matrix) {
      if (!entry.email) {
        return Response.json({ error: 'Cada entrada deve ter email' }, { status: 400 });
      }
      if (!entry.app_role || !VALID_APP_ROLES.has(entry.app_role)) {
        return Response.json({ error: `app_role inválido para ${entry.email}` }, { status: 400 });
      }
      if (entry.app_role === 'hq_admin' && entry.tenant_id) {
        return Response.json({ error: `hq_admin (${entry.email}) deve ter tenant_id = null` }, { status: 400 });
      }
      if (entry.app_role !== 'hq_admin' && !entry.tenant_id) {
        return Response.json({ error: `${entry.app_role} (${entry.email}) requer tenant_id` }, { status: 400 });
      }
    }

    // ── 2. Load all users and all tenants ──
    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 200);
    const allTenants = await base44.asServiceRole.entities.Tenant.list('-created_date', 100);
    const tenantIds = new Set(allTenants.map((t: any) => t.id));

    // ── 3. Build email → matrix entry map (with uniqueness check) ──
    const matrixByEmail = new Map();
    const matrixErrors: string[] = [];
    for (const entry of migration_matrix) {
      const key = entry.email.toLowerCase();
      if (matrixByEmail.has(key)) {
        matrixErrors.push(`Email duplicado na matriz: ${entry.email}`);
      }
      matrixByEmail.set(key, entry);
    }

    // ── 4. Preflight: build blockers list ──
    const blockers: any[] = [];
    const userMatrixMap = new Map(); // user.id → matrix entry

    for (const u of allUsers) {
      const email = u.email?.toLowerCase();
      const matrixEntry = email ? matrixByEmail.get(email) : null;

      if (!matrixEntry) {
        // Admin without matrix entry = BLOCKER (no inference)
        if (u.role === 'admin') {
          blockers.push({
            email: u.email,
            code: 'ADMIN_NOT_IN_MATRIX',
            message: `Admin técnico não incluído na matriz. Inclua explicitamente com app_role desejado.`,
            current: { role: u.role, app_role: u.app_role || null, tenant_id: u.tenant_id || null },
          });
        }
        // Non-admin without matrix → app_role stays null → DENY (no action needed)
        continue;
      }

      userMatrixMap.set(u.id, matrixEntry);

      const desiredAppRole = matrixEntry.app_role;
      const expectedRole = expectedBuiltInRole(desiredAppRole);

      // Validate built-in role compatibility
      if (u.role !== expectedRole) {
        blockers.push({
          email: u.email,
          code: 'BUILT_IN_ROLE_MISMATCH',
          message: `Built-in role incompatível. Esperado ${expectedRole}, encontrado ${u.role}.`,
          current: { role: u.role, app_role: u.app_role || null, tenant_id: u.tenant_id || null },
          expected_role: expectedRole,
          actual_role: u.role,
        });
        continue;
      }

      // Validate hq_admin has null tenant
      if (desiredAppRole === 'hq_admin' && matrixEntry.tenant_id) {
        blockers.push({
          email: u.email,
          code: 'HQ_ADMIN_TENANT_NOT_NULL',
          message: `hq_admin deve ter tenant_id = null`,
        });
        continue;
      }

      // Validate non-HQ has tenant
      if (desiredAppRole !== 'hq_admin' && !matrixEntry.tenant_id) {
        blockers.push({
          email: u.email,
          code: 'MISSING_TENANT_ID',
          message: `${desiredAppRole} requer tenant_id`,
        });
        continue;
      }

      // Validate tenant exists
      if (desiredAppRole !== 'hq_admin' && matrixEntry.tenant_id && !tenantIds.has(matrixEntry.tenant_id)) {
        blockers.push({
          email: u.email,
          code: 'TENANT_NOT_FOUND',
          message: `Tenant ${matrixEntry.tenant_id} não existe`,
        });
        continue;
      }
    }

    // Check for matrix entries that don't match any user
    for (const entry of migration_matrix) {
      const key = entry.email.toLowerCase();
      const found = allUsers.some((u: any) => u.email?.toLowerCase() === key);
      if (!found) {
        blockers.push({
          email: entry.email,
          code: 'USER_NOT_FOUND',
          message: `Nenhum usuário encontrado com email ${entry.email}`,
        });
      }
    }

    // Add matrix errors as blockers
    for (const msg of matrixErrors) {
      blockers.push({ code: 'DUPLICATE_EMAIL', message: msg });
    }

    // ── 5. If blockers exist, return 409 (no partial application) ──
    if (blockers.length > 0) {
      return Response.json(
        {
          success: false,
          dry_run: isDryRun,
          blockers,
          blocker_count: blockers.length,
          message: 'Blockers impedem a migração. Corrija e tente novamente.',
        },
        { status: 409 }
      );
    }

    // ── 6. Build before report ──
    const before = allUsers.map((u: any) => ({
      email: u.email,
      role: u.role,
      app_role: u.app_role || null,
      tenant_id: u.tenant_id || null,
    }));

    // ── 7. If dry-run, return report without applying ──
    if (isDryRun) {
      const expected = allUsers.map((u: any) => {
        const entry = userMatrixMap.get(u.id);
        if (!entry) {
          return {
            email: u.email,
            role: u.role,
            app_role_expected: u.role === 'admin' ? null : null, // admin not in matrix = blocker; non-admin stays null
            tenant_id_expected: u.tenant_id || null,
          };
        }
        return {
          email: u.email,
          role: u.role,
          app_role_expected: entry.app_role,
          tenant_id_expected: entry.app_role === 'hq_admin' ? null : entry.tenant_id,
        };
      });

      const notInMatrix = allUsers
        .filter((u: any) => !userMatrixMap.has(u.id))
        .map((u: any) => ({ email: u.email, role: u.role, app_role: u.app_role || null }));

      return Response.json({
        success: true,
        dry_run: true,
        message: 'Dry-run concluído. Nenhum registro foi alterado.',
        summary: {
          total_users: allUsers.length,
          in_matrix: userMatrixMap.size,
          not_in_matrix: notInMatrix.length,
          blockers: 0,
        },
        before,
        expected,
        not_in_matrix: notInMatrix.map((u: any) => ({ email: u.email, role: u.role })),
      });
    }

    // ── 8. Apply: all-or-nothing with rollback ──
    const applied: any[] = [];
    const originalStates = new Map();

    for (const u of allUsers) {
      const entry = userMatrixMap.get(u.id);
      if (!entry) continue;

      const newAppRole = entry.app_role;
      const newTenantId = entry.app_role === 'hq_admin' ? null : entry.tenant_id;

      // Save original state for potential rollback
      originalStates.set(u.id, {
        app_role: u.app_role || null,
        tenant_id: u.tenant_id || null,
      });

      try {
        await base44.asServiceRole.entities.User.update(u.id, {
          app_role: newAppRole,
          tenant_id: newTenantId,
        });

        // Re-read and verify postcondition
        const reRead = await base44.asServiceRole.entities.User.get(u.id);
        if (reRead.app_role !== newAppRole || reRead.tenant_id !== newTenantId) {
          throw new Error('PROFILE_POSTCONDITION_FAILED');
        }

        applied.push({
          email: reRead.email,
          role: reRead.role,
          app_role_before: u.app_role || null,
          app_role_after: reRead.app_role,
          tenant_id_before: u.tenant_id || null,
          tenant_id_after: reRead.tenant_id,
        });
      } catch (e) {
        // ── Rollback all previously updated users ──
        const rollbackFailures: any[] = [];
        for (const [rollbackId, origState] of originalStates) {
          try {
            await base44.asServiceRole.entities.User.update(rollbackId, {
              app_role: origState.app_role,
              tenant_id: origState.tenant_id,
            });
            // Postcondition: re-read and verify rollback applied
            const rolledBack = await base44.asServiceRole.entities.User.get(rollbackId);
            if (rolledBack.app_role !== origState.app_role || rolledBack.tenant_id !== origState.tenant_id) {
              throw new Error('ROLLBACK_POSTCONDITION_FAILED');
            }
          } catch (rbErr) {
            const rbUser = allUsers.find((x: any) => x.id === rollbackId);
            rollbackFailures.push({ email: rbUser?.email || rollbackId, reason: `rollback_failed: ${rbErr.message}` });
          }
        }

        return Response.json({
          success: false,
          dry_run: false,
          rollback_complete: rollbackFailures.length === 0,
          error: rollbackFailures.length > 0
            ? 'Migração falhou — rollback parcial: alguns usuários não puderam ser revertidos.'
            : 'Migração falhou — todos os usuários foram revertidos ao estado original.',
          failed_user: u.email,
          failure_reason: e.message,
          applied_before_failure: applied.length,
          rollback_failures: rollbackFailures.length,
          rollback_failure_details: rollbackFailures,
        }, { status: 500 });
      }
    }

    // ── 9. Build after report from re-read values ──
    const reReadAll = await base44.asServiceRole.entities.User.list('-created_date', 200);
    const after = reReadAll.map((u: any) => ({
      email: u.email,
      role: u.role,
      app_role: u.app_role || null,
      tenant_id: u.tenant_id || null,
    }));

    // ── 10. AuditLog ──
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        tenant_id: null,
        action: 'MIGRATE_USER_ACCESS_PROFILES',
        actor_email: actor.email,
        actor_app_role: 'hq_admin',
        applied_count: applied.length,
        skipped_count: 0,
        total_users: allUsers.length,
        timestamp: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn('[migrate] AuditLog creation failed:', auditErr?.message);
    }

    return Response.json({
      success: true,
      dry_run: false,
      summary: {
        total_users: allUsers.length,
        applied: applied.length,
        skipped: 0,
      },
      applied,
      report: { before, after },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});