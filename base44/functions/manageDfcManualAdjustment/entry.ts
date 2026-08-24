import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
const VALID_ACTIVITIES = new Set(['operating', 'investing', 'financing']);
function resolveAppRole(user) {
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  return user?.role === 'admin' ? 'hq_admin' : null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });
    if (!WRITE_ROLES.has(appRole)) return Response.json({ error: 'Forbidden: insufficient role' }, { status: 403 });
    const body = await req.json();
    const { action, adjustment_id, financial_diagnosis_id } = body;
    if (!financial_diagnosis_id || !['create', 'update', 'delete'].includes(action)) return Response.json({ error: 'Payload inválido' }, { status: 400 });
    const diagnosis = await base44.asServiceRole.entities.FinancialDiagnosis.get(financial_diagnosis_id);
    if (!diagnosis) return Response.json({ error: 'Diagnóstico não encontrado' }, { status: 404 });
    if (resolveAppRole(user) !== 'hq_admin' && diagnosis.tenant_id !== user.tenant_id) return Response.json({ error: 'Forbidden: tenant mismatch' }, { status: 403 });
    let previous = null;
    if (adjustment_id) {
      try {
        previous = await base44.asServiceRole.entities.FinancialDfcManualAdjustment.get(adjustment_id);
      } catch (error) {
        if (action === 'delete') return Response.json({ success: true, action, adjustment_id, already_deleted: true });
        throw error;
      }
      if (!previous || previous.financial_diagnosis_id !== financial_diagnosis_id) return Response.json({ error: 'Ajuste não encontrado' }, { status: 404 });
    }
    if (action !== 'delete') {
      if (!VALID_ACTIVITIES.has(body.activity) || !body.label?.trim() || !body.justification?.trim() || !body.period) return Response.json({ error: 'Atividade, nome, período e justificativa são obrigatórios' }, { status: 400 });
      if (!Number.isFinite(Number(body.value)) || Number(body.value) === 0) return Response.json({ error: 'Valor deve ser numérico e diferente de zero' }, { status: 400 });
    }
    const now = new Date().toISOString();
    const payload = action === 'delete' ? null : {
      tenant_id: diagnosis.tenant_id, financial_diagnosis_id, financial_upload_id: body.financial_upload_id || null,
      period: body.period, column_key: body.column_key || body.period, activity: body.activity, label: body.label.trim(),
      value: Number(body.value), adjustment_type: body.adjustment_type || 'outros', notes: body.notes || null,
      justification: body.justification.trim(), previous_value: previous?.value ?? null, new_value: Number(body.value),
      reconciliation_effect: Number(body.value), source_snapshot_id: diagnosis.current_processing_snapshot_id || null,
      ...(previous ? { updated_by: user.email, updated_at: now } : { created_by: user.email, created_at: now }),
    };
    let saved;
    if (action === 'create') saved = await base44.asServiceRole.entities.FinancialDfcManualAdjustment.create(payload);
    if (action === 'update') saved = await base44.asServiceRole.entities.FinancialDfcManualAdjustment.update(adjustment_id, payload);
    if (action === 'delete') { await base44.asServiceRole.entities.FinancialDfcManualAdjustment.delete(adjustment_id); saved = previous; }
    try {
      const response = await base44.functions.invoke('buildFinancialStatements', {
        upload_id: body.financial_upload_id || previous?.financial_upload_id,
        diagnosis_id: financial_diagnosis_id,
        dfc_only: true,
        manual_adjustment_delta: action === 'delete'
          ? { remove_id: adjustment_id }
          : { upsert: { id: saved.id, period: payload.period, column_key: payload.column_key, activity: payload.activity, value: payload.value } },
      });
      const result = response?.data || response;
      if (!result?.snapshot_id) throw new Error('DFC_MANUAL_ADJUSTMENT_SNAPSHOT_REQUIRED');
      if (action !== 'delete') await base44.asServiceRole.entities.FinancialDfcManualAdjustment.update(saved.id, { source_snapshot_id: result.snapshot_id });
      return Response.json({ success: true, action, adjustment_id: saved.id, snapshot_id: result.snapshot_id, reconciliation_effect: action === 'delete' ? -Number(previous.value) : Number(payload.value) - Number(previous?.value || 0) });
    } catch (error) {
      if (action === 'create' && saved?.id) await base44.asServiceRole.entities.FinancialDfcManualAdjustment.delete(saved.id);
      if (action === 'update' && previous) await base44.asServiceRole.entities.FinancialDfcManualAdjustment.update(adjustment_id, previous);
      if (action === 'delete' && previous) await base44.asServiceRole.entities.FinancialDfcManualAdjustment.create(previous);
      throw error;
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});