import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveAppRole } from '../../shared/accessGovernance.ts';

async function fetchAll(entity, filter, limit = 200) { const rows = []; let cursor = null; while (rows.length < limit) { const page = await entity.filter(cursor ? { ...filter, id: { $gt: cursor } } : filter, 'id', Math.min(100, limit - rows.length)); if (!page.length) break; rows.push(...page); cursor = page.at(-1).id; if (page.length < 100) break; } return rows; }
function userView(user) { return { id: user.id, full_name: user.full_name || null, email: user.email, app_role: user.app_role || null, access_status: user.access_status || 'active', revoked_at: user.revoked_at || null }; }
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req); const actor = await base44.auth.me();
    if (!actor) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { tenant_id: tenantId } = await req.json(); const role = resolveAppRole(actor);
    if (!tenantId || !['hq_admin', 'tenant_admin'].includes(role || '') || (role === 'tenant_admin' && actor.tenant_id !== tenantId)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const [users, pending, history] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.User, { tenant_id: tenantId }),
      fetchAll(base44.asServiceRole.entities.PendingUserAccessProfile, { tenant_id: tenantId, status: 'pending' }),
      fetchAll(base44.asServiceRole.entities.AuditLog, { tenant_id: tenantId }, 100)
    ]);
    return Response.json({ users: users.map(userView), pending: pending.map((item) => ({ id: item.id, email: item.email, app_role: item.app_role, status: item.status })), history: history.sort((a, b) => String(b.timestamp || b.created_date).localeCompare(String(a.timestamp || a.created_date))).slice(0, 50).map((item) => ({ id: item.id, action: item.action, timestamp: item.timestamp || item.created_date, entity_type: item.entity_type || null })) });
  } catch (error) { return Response.json({ error: 'Não foi possível carregar a administração de usuários.' }, { status: 500 }); }
});