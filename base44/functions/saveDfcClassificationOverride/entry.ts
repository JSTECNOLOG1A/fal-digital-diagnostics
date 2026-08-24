import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ── resolveAppRole (inlined — backend functions deploy independently) ──
const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

const VALID_BUCKETS = new Set([
  'cash', 'non_cash_adjustment', 'operating_asset', 'operating_liability',
  'investing', 'financing', 'ignored', 'requires_review',
]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const {
      action,
      financial_diagnosis_id,
      rubric_key,
      rubric_label,
      canonical_key,
      group_label,
      auto_bucket,
      manual_bucket,
      reason,
      period,
      comparison_period,
    } = body;

    if (!financial_diagnosis_id || !rubric_key) {
      return Response.json({ error: 'financial_diagnosis_id e rubric_key são obrigatórios' }, { status: 400 });
    }

    // ── Tenant Guard ──
    const _tgDiag = await base44.asServiceRole.entities.FinancialDiagnosis.get(financial_diagnosis_id);
    if (!_tgDiag) return Response.json({ error: 'Diagnóstico não encontrado' }, { status: 404 });
      // SEG-03: Role guard — deny client_viewer from triggering mutations
      const WRITE_ROLES = ['hq_admin', 'tenant_admin', 'consultant'];
      if (!WRITE_ROLES.includes(appRole)) {
        return Response.json({ error: 'Forbidden: insufficient role' }, { status: 403 });
      }

    if ((appRole !== 'hq_admin') && _tgDiag.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Acesso negado: tenant não autorizado' }, { status: 403 });
    }

    // Buscar diagnóstico para obter tenant_id
    const diagnosis = await base44.entities.FinancialDiagnosis.get(financial_diagnosis_id);
    if (!diagnosis) {
      return Response.json({ error: 'Diagnóstico não encontrado' }, { status: 404 });
    }
    const tenant_id = diagnosis.tenant_id;

    // ── Modo clear: desativar override existente (status = inactive) ──
    if (action === 'clear') {
      const existing = await base44.asServiceRole.entities.FinancialDfcClassificationOverride.filter(
        { financial_diagnosis_id, tenant_id, rubric_key, status: 'active' }, 'id', 10
      );
      if (existing.length === 0) {
        return Response.json({ success: true, message: 'Nenhum override ativo encontrado para esta rubrica', cleared: false });
      }
      for (const ov of existing) {
        await base44.asServiceRole.entities.FinancialDfcClassificationOverride.update(ov.id, {
          status: 'inactive',
          updated_by: user.email,
        });
      }
      return Response.json({ success: true, message: 'Override desativado', cleared: true, rubric_key });
    }

    // ── Modo save: validar e upsert override ──
    if (!VALID_BUCKETS.has(manual_bucket)) {
      return Response.json({ error: `manual_bucket inválido: ${manual_bucket}` }, { status: 400 });
    }
    if (!auto_bucket || !VALID_BUCKETS.has(auto_bucket)) {
      return Response.json({ error: 'auto_bucket obrigatório e deve ser válido' }, { status: 400 });
    }

    // A rubrica precisa existir no output corrente, nunca em composição histórica.
    const currentSnapshot = diagnosis.current_processing_snapshot_id
      ? await base44.asServiceRole.entities.FinancialProcessingSnapshot.get(diagnosis.current_processing_snapshot_id)
      : null;
    const currentRunId = currentSnapshot?.status === 'active' ? currentSnapshot.financial_processing_run_id : null;
    if (!currentRunId) return Response.json({ error: 'CURRENT_FINANCIAL_OUTPUT_REQUIRED' }, { status: 409 });
    const compositionMatch = await base44.asServiceRole.entities.FinancialDfcCompositionLine.filter(
      { financial_diagnosis_id, processing_run_id: currentRunId, publication_status: 'active', rubric_key }, 'id', 1
    );
    if (compositionMatch.length === 0) {
      return Response.json({
        error: `Rubrica "${rubric_key}" não encontrada na composição atual da DFC deste diagnóstico. Recarregue a tela e tente novamente.`,
        hint: 'O rubric_key do override deve corresponder exatamente ao rubric_key de uma FinancialDfcCompositionLine ativa.',
      }, { status: 400 });
    }

    // Buscar override ativo existente por diagnosis + rubric_key
    const existing = await base44.asServiceRole.entities.FinancialDfcClassificationOverride.filter(
      { financial_diagnosis_id, tenant_id, rubric_key, status: 'active' }, 'id', 10
    );

    const payload = {
      tenant_id,
      financial_diagnosis_id,
      rubric_key,
      rubric_label: rubric_label || null,
      canonical_key: canonical_key || null,
      group_label: group_label || null,
      auto_bucket,
      manual_bucket,
      reason: reason || null,
      status: 'active',
      updated_by: user.email,
    };
    if (period) payload.period = period;
    if (comparison_period) payload.comparison_period = comparison_period;

    let saved;
    if (existing.length > 0) {
      // Atualizar override existente
      saved = await base44.asServiceRole.entities.FinancialDfcClassificationOverride.update(existing[0].id, payload);
    } else {
      // Criar novo override
      payload.created_by = user.email;
      saved = await base44.asServiceRole.entities.FinancialDfcClassificationOverride.create(payload);
    }

    return Response.json({ success: true, override: saved, rubric_key, manual_bucket });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});