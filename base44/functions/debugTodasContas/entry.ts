/**
 * debugTodasContas
 * Lista TODAS as contas e como foram mapeadas
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });
  if (appRole !== 'hq_admin') return Response.json({ error: 'Forbidden: função de debug restrita a hq_admin' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  let { upload_id, diagnosis_id } = body;

  if (!upload_id || !diagnosis_id) {
    const uploads = await base44.asServiceRole.entities.FinancialUpload.filter({}, '-created_date', 1);
    if (uploads.length === 0) {
      return Response.json({ error: 'Nenhum upload encontrado' }, { status: 404 });
    }
    upload_id = uploads[0].id;
    diagnosis_id = uploads[0].financial_diagnosis_id;
  }

  try {
    const mappings = await base44.asServiceRole.entities.FinancialMappingResolution.filter({
      financial_upload_id: upload_id,
    }, 'account_code', 1000);

    const byStatus = {
      mapped: [],
      unmapped: [],
    };

    for (const m of mappings) {
      if (m.blocking_issue) {
        byStatus.unmapped.push(m);
      } else {
        byStatus.mapped.push(m);
      }
    }

    // Agrupar por canonical_key
    const byCanonical = {};
    for (const m of byStatus.mapped) {
      const key = m.managerial_rubric || 'null';
      if (!byCanonical[key]) byCanonical[key] = [];
      byCanonical[key].push(m);
    }

    return Response.json({
      upload_id,
      total_accounts: mappings.length,
      mapped_count: byStatus.mapped.length,
      unmapped_count: byStatus.unmapped.length,
      by_canonical_key: Object.entries(byCanonical).reduce((acc, [key, items]) => {
        acc[key] = {
          count: items.length,
          accounts: items.slice(0, 5).map(i => ({ code: i.account_code, desc: i.account_description })),
        };
        return acc;
      }, {}),
      unmapped_sample: byStatus.unmapped.slice(0, 10),
    });
  } catch (error) {
    console.error('[debugTodasContas]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});