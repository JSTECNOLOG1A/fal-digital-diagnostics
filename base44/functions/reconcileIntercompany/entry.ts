/**
 * reconcileIntercompany
 * Cria/atualiza conciliação intragrupo A × B.
 *
 * Payload: { action: 'create'|'update'|'resolve', diagnosis_id, reconciliation_id?, ...reconData }
 * - create: compara saldos A vs B, calcula matched_amount e difference
 * - update: atualiza resolution_notes/status
 * - resolve: marca como resolved
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    if (action === 'create') {
      const { diagnosis_id, period, entity_a_id, entity_b_id, entity_a_name, entity_b_name,
              reconciliation_type, account_a_code, account_b_code,
              account_a_canonical_key, account_b_canonical_key, amount_a, amount_b } = body;

      if (!diagnosis_id || !period || !entity_a_id || !entity_b_id) {
        return Response.json({ error: 'diagnosis_id, period, entity_a_id, entity_b_id obrigatórios' }, { status: 400 });
      }

      const diagnosis = await base44.asServiceRole.entities.FinancialDiagnosis.get(diagnosis_id);
      if (!diagnosis) return Response.json({ error: 'Diagnóstico não encontrado' }, { status: 404 });
      // ── Tenant Guard ──
        // SEG-03: Role guard — deny client_viewer from triggering mutations
        const WRITE_ROLES = ['hq_admin', 'tenant_admin', 'consultant'];
        if (!WRITE_ROLES.includes(appRole)) {
          return Response.json({ error: 'Forbidden: insufficient role' }, { status: 403 });
        }

      if ((appRole !== 'hq_admin') && diagnosis.tenant_id !== user.tenant_id) {
        return Response.json({ error: 'Acesso negado: tenant não autorizado' }, { status: 403 });
      }

      const a = Number(amount_a) || 0;
      const b = Number(amount_b) || 0;

      // matched_amount = menor valor absoluto (quando sinais compatíveis)
      // difference = |amount_a - amount_b|
      const matchedAmount = Math.min(Math.abs(a), Math.abs(b));
      const differenceAmount = Math.abs(a - b);

      let status = 'unmatched';
      if (differenceAmount === 0) status = 'matched';
      else if (matchedAmount > 0 && differenceAmount < matchedAmount * 0.05) status = 'matched_with_difference';
      else if (matchedAmount > 0) status = 'matched_with_difference';
      else status = 'unmatched';

      const recon = await base44.asServiceRole.entities.FinancialIntercompanyReconciliation.create({
        tenant_id: diagnosis.tenant_id,
        financial_diagnosis_id: diagnosis_id,
        preparation_run_id: null,
        period,
        entity_a_id, entity_a_name: entity_a_name || null,
        entity_b_id, entity_b_name: entity_b_name || null,
        reconciliation_type: reconciliation_type || 'intercompany_balance',
        account_a_code: account_a_code || null,
        account_b_code: account_b_code || null,
        account_a_canonical_key: account_a_canonical_key || null,
        account_b_canonical_key: account_b_canonical_key || null,
        amount_a: a,
        amount_b: b,
        matched_amount: matchedAmount,
        difference_amount: differenceAmount,
        status,
        created_by: user.email,
      });

      return Response.json({ success: true, reconciliation: recon });
    }

    if (action === 'update') {
      const { reconciliation_id, status, resolution_notes } = body;
      if (!reconciliation_id) return Response.json({ error: 'reconciliation_id obrigatório' }, { status: 400 });
      const recon = await base44.asServiceRole.entities.FinancialIntercompanyReconciliation.get(reconciliation_id);
      if (!recon) return Response.json({ error: 'Conciliação não encontrada' }, { status: 404 });

      const updates = {};
      if (status) updates.status = status;
      if (resolution_notes !== undefined) updates.resolution_notes = resolution_notes;
      const updated = await base44.asServiceRole.entities.FinancialIntercompanyReconciliation.update(reconciliation_id, updates);
      return Response.json({ success: true, reconciliation: updated });
    }

    if (action === 'resolve') {
      const { reconciliation_id, resolution_notes } = body;
      if (!reconciliation_id) return Response.json({ error: 'reconciliation_id obrigatório' }, { status: 400 });
      const updated = await base44.asServiceRole.entities.FinancialIntercompanyReconciliation.update(reconciliation_id, {
        status: 'resolved', resolution_notes: resolution_notes || null,
      });
      return Response.json({ success: true, reconciliation: updated });
    }

    return Response.json({ error: 'Action inválido: create|update|resolve' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});