/**
 * assignGroupOrderNumber
 *
 * Assigns the next sequential group_order_number for a tenant.
 * Also serves as a backfill endpoint when called with { backfill: true }.
 *
 * CROSS-002 FIX: In single-group mode, loads the group FIRST to derive
 * canonicalTenantId from group.tenant_id (not payload tenant_id).
 *
 * Usage:
 *   POST { group_id, tenant_id }           → assigns number to a specific group (if not already set)
 *   POST { backfill: true, tenant_id }     → fills all groups without number, ordered by created_date asc
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user: any): string | null {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';

    // SEG-03: Write guard — blocks client_viewer from mutations
    const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
    if (!WRITE_ROLES.has(appRole)) {
      return Response.json({ error: 'Forbidden: write permission required' }, { status: 403 });
    }

    const body = await req.json();
    const { group_id, tenant_id, backfill } = body;

    // --- BACKFILL MODE ---
    if (backfill) {
      if (!tenant_id) return Response.json({ error: 'tenant_id required' }, { status: 400 });

      // Backfill requires admin-level role
      const ADMIN_ROLES = new Set(['hq_admin', 'tenant_admin']);
      if (!ADMIN_ROLES.has(appRole)) {
        return Response.json({ error: 'Forbidden: admin role required for backfill' }, { status: 403 });
      }

      // Tenant guard: non-HQ can only backfill own tenant
      if (!isHQ && tenant_id !== user.tenant_id) {
        return Response.json({ error: 'Forbidden — cross-tenant access denied' }, { status: 403 });
      }

      // Fetch all groups for tenant, sorted by created_date asc
      const allGroups = await base44.asServiceRole.entities.Group.filter(
        { tenant_id },
        'created_date',
        1000
      );

      const withNumber = allGroups.filter(g => g.group_order_number != null);
      const withoutNumber = allGroups.filter(g => g.group_order_number == null);

      if (withoutNumber.length === 0) {
        return Response.json({ message: 'All groups already have order numbers', total: allGroups.length });
      }

      let maxNum = withNumber.reduce((max, g) => Math.max(max, g.group_order_number), 0);

      const updated = [];
      for (const g of withoutNumber) {
        maxNum += 1;
        await base44.asServiceRole.entities.Group.update(g.id, { group_order_number: maxNum });
        updated.push({ id: g.id, name: g.name, group_order_number: maxNum });
      }

      return Response.json({
        message: `Backfill complete. ${updated.length} groups numbered.`,
        updated,
      });
    }

    // --- SINGLE GROUP ASSIGNMENT MODE ---
    if (!group_id) return Response.json({ error: 'group_id required' }, { status: 400 });

    // CROSS-002: Load group FIRST to get canonical tenant
    const group = await base44.asServiceRole.entities.Group.get(group_id);
    if (!group) return Response.json({ error: 'Group not found' }, { status: 404 });

    const canonicalTenantId = group.tenant_id;

    // Validate user tenant against canonical
    if (!isHQ && canonicalTenantId !== user.tenant_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Reject if payload tenant_id diverges from canonical
    if (tenant_id && tenant_id !== canonicalTenantId) {
      return Response.json({ error: 'Tenant mismatch' }, { status: 403 });
    }

    // Already has a number — return it (idempotent)
    if (group.group_order_number != null) {
      return Response.json({ group_order_number: group.group_order_number, already_set: true });
    }

    // Fetch all existing numbers for this tenant to find next
    const existing = await base44.asServiceRole.entities.Group.filter(
      { tenant_id: canonicalTenantId },
      'group_order_number',
      1000
    );

    const maxNum = existing.reduce((max, g) => {
      return g.group_order_number != null ? Math.max(max, g.group_order_number) : max;
    }, 0);

    const nextNum = maxNum + 1;

    await base44.asServiceRole.entities.Group.update(group_id, { group_order_number: nextNum });

    return Response.json({ group_order_number: nextNum, assigned: true });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});