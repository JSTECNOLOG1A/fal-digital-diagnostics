import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
const ENTRY_NATURES = new Set(['elimination', 'consolidation_adjustment', 'reclassification']);
const ENTRY_TYPES = new Set(['intercompany_balance','intercompany_revenue_expense','investment_equity','intercompany_loan','dividend','interest_on_equity','unrealized_profit_inventory','unrealized_profit_fixed_asset','equity_method','non_controlling_interest','goodwill','accounting_policy_adjustment','manual_adjustment']);
const MUTABLE_FIELDS = ['entry_nature','entry_type','period','source_entity_id','counterparty_entity_id','debit_canonical_key','credit_canonical_key','amount','description','rationale','justification','debit_account_code','debit_account_name','credit_account_code','credit_account_name'];

function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  return user?.role === 'admin' ? 'hq_admin' : null;
}
const logicalKeyFor = (entry) => [entry.period,entry.source_entity_id,entry.counterparty_entity_id,entry.debit_canonical_key,entry.credit_canonical_key,Number(entry.amount)].join('|');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });
    const appRole = resolveAppRole(user);
    if (!WRITE_ROLES.has(appRole)) return Response.json({ error: 'Forbidden: insufficient role' }, { status: 403 });

    const body = await req.json();
    const action = body.action;
    const allowedActions = new Set(['create','update','delete','submit','approve','post','reverse_to_draft','reverse']);
    if (!allowedActions.has(action)) return Response.json({ error: 'Action inválido' }, { status: 400 });

    let current = null;
    if (action !== 'create') {
      if (!body.entry_id) return Response.json({ error: 'entry_id obrigatório' }, { status: 400 });
      current = await base44.asServiceRole.entities.FinancialConsolidationEntry.get(body.entry_id);
      if (!current) return Response.json({ error: 'Entrada não encontrada' }, { status: 404 });
    }
    const diagnosisId = body.diagnosis_id || current?.financial_diagnosis_id;
    const diagnosis = await base44.asServiceRole.entities.FinancialDiagnosis.get(diagnosisId);
    if (!diagnosis) return Response.json({ error: 'Diagnóstico não encontrado' }, { status: 404 });
    if (appRole !== 'hq_admin' && diagnosis.tenant_id !== user.tenant_id) return Response.json({ error: 'Forbidden: tenant mismatch' }, { status: 403 });
    if (diagnosis.analysis_type === 'individual') return Response.json({ error: 'INDIVIDUAL_CONSOLIDATION_FORBIDDEN' }, { status: 400 });
    const currentSnapshot = diagnosis.current_processing_snapshot_id ? await base44.asServiceRole.entities.FinancialProcessingSnapshot.get(diagnosis.current_processing_snapshot_id) : null;
    const currentRunId = currentSnapshot?.status === 'active' ? currentSnapshot.financial_processing_run_id : null;
    if (!currentRunId) return Response.json({ error: 'CURRENT_FINANCIAL_OUTPUT_REQUIRED' }, { status: 409 });

    const scope = await base44.asServiceRole.entities.FinancialAnalysisScopeEntity.filter({ financial_diagnosis_id: diagnosisId, is_active: true }, 'id', 200);
    const scopeByEntity = new Map(scope.map((item) => [item.entity_id, item]));

    const validateEntry = async (candidate, excludeId = null) => {
      const normalizedJustification = String(candidate.justification ?? candidate.rationale ?? '').trim();
      const normalized = {
        ...candidate,
        origin_entity_id: candidate.source_entity_id,
        destination_entity_id: candidate.counterparty_entity_id,
        justification: normalizedJustification,
        rationale: normalizedJustification,
      };
      const engineResponse = await base44.functions.invoke('executeFinancialEngine', { action: 'validate_entry', entry: normalized });
      const engineValidation = engineResponse?.data || engineResponse;
      const errors = [...(engineValidation.errors || [])];
      if (candidate.justification != null && candidate.rationale != null && String(candidate.justification).trim() !== String(candidate.rationale).trim()) errors.push({ code: 'ELIMINATION_JUSTIFICATION_CONFLICT' });
      if (!ENTRY_NATURES.has(candidate.entry_nature)) errors.push({ code: 'ELIMINATION_NATURE_INVALID' });
      if (!ENTRY_TYPES.has(candidate.entry_type)) errors.push({ code: 'ELIMINATION_TYPE_INVALID' });
      if (!scopeByEntity.has(candidate.source_entity_id) || !scopeByEntity.has(candidate.counterparty_entity_id)) errors.push({ code: 'ELIMINATION_ENTITY_OUTSIDE_PERIMETER' });
      const periodLines = await base44.asServiceRole.entities.FinancialStatementLine.filter({ financial_diagnosis_id: diagnosisId, processing_run_id: currentRunId, publication_status: 'active', period: candidate.period }, 'id', 1);
      if (periodLines.length === 0) errors.push({ code: 'ELIMINATION_PERIOD_NOT_FOUND' });
      if (diagnosis.analysis_type === 'consolidated' && diagnosis.parent_entity_id && !scopeByEntity.has(diagnosis.parent_entity_id)) errors.push({ code: 'ELIMINATION_PARENT_MISMATCH' });
      const expectedScope = diagnosis.analysis_type === 'combined' ? 'combined' : 'consolidated';
      if (candidate.dataset_scope && candidate.dataset_scope !== expectedScope) errors.push({ code: 'ELIMINATION_DATASET_SCOPE_MISMATCH' });
      const logicalKey = logicalKeyFor(candidate);
      const existing = await base44.asServiceRole.entities.FinancialConsolidationEntry.filter({ financial_diagnosis_id: diagnosisId }, 'entry_number', 500);
      if (existing.some((entry) => entry.id !== excludeId && entry.status !== 'reversed' && entry.logical_key === logicalKey)) errors.push({ code: 'ELIMINATION_DUPLICATE' });
      return { valid: errors.length === 0, errors, logicalKey, statementCode: engineValidation.statement_code, existing };
    };

    if (action === 'create') {
      const candidate = { ...body, dataset_scope: diagnosis.analysis_type === 'combined' ? 'combined' : 'consolidated' };
      const validation = await validateEntry(candidate);
      if (!validation.valid) return Response.json({ error: validation.errors[0]?.code, errors: validation.errors }, { status: validation.errors.some((item) => item.code === 'ELIMINATION_DUPLICATE') ? 409 : 400 });
      const maxNumber = validation.existing.reduce((max, entry) => Math.max(max, entry.entry_number || 0), 0);
      const entry = await base44.asServiceRole.entities.FinancialConsolidationEntry.create({
        tenant_id: diagnosis.tenant_id, financial_diagnosis_id: diagnosisId, preparation_run_id: null,
        period: candidate.period, entry_number: maxNumber + 1, entry_nature: candidate.entry_nature, entry_type: candidate.entry_type,
        source_entity_id: candidate.source_entity_id, source_entity_name: scopeByEntity.get(candidate.source_entity_id)?.entity_name || null,
        counterparty_entity_id: candidate.counterparty_entity_id, counterparty_entity_name: scopeByEntity.get(candidate.counterparty_entity_id)?.entity_name || null,
        origin_entity_id: candidate.source_entity_id, destination_entity_id: candidate.counterparty_entity_id,
        debit_account_code: candidate.debit_account_code || null, debit_account_name: candidate.debit_account_name || null,
        debit_canonical_key: candidate.debit_canonical_key, credit_account_code: candidate.credit_account_code || null,
        credit_account_name: candidate.credit_account_name || null, credit_canonical_key: candidate.credit_canonical_key,
        canonical_key: candidate.debit_canonical_key, statement_code: validation.statementCode, dataset_scope: candidate.dataset_scope,
        amount: Number(candidate.amount), description: candidate.description || null, rationale: String(candidate.justification ?? candidate.rationale ?? '').trim(), justification: String(candidate.justification ?? candidate.rationale ?? '').trim(),
        logical_key: validation.logicalKey, reconciliation_status: 'pending', origin_type: 'manual', status: 'draft', created_by: user.email, created_at: new Date().toISOString(),
      });
      return Response.json({ success: true, entry });
    }

    if (action === 'update') {
      if (!['draft','pending_review','approved'].includes(current.status)) return Response.json({ error: `Status ${current.status} não permite edição` }, { status: 400 });
      const updates = {};
      for (const field of MUTABLE_FIELDS) if (body[field] !== undefined) updates[field] = body[field];
      const candidate = { ...current, ...updates, amount: updates.amount === undefined ? current.amount : Number(updates.amount) };
      const validation = await validateEntry(candidate, current.id);
      if (!validation.valid) return Response.json({ error: validation.errors[0]?.code, errors: validation.errors }, { status: validation.errors.some((item) => item.code === 'ELIMINATION_DUPLICATE') ? 409 : 400 });
      const normalizedJustification = String(candidate.justification ?? candidate.rationale ?? '').trim();
      Object.assign(updates, {
        amount: Number(candidate.amount), rationale: normalizedJustification, justification: normalizedJustification, origin_entity_id: candidate.source_entity_id, destination_entity_id: candidate.counterparty_entity_id,
        source_entity_name: scopeByEntity.get(candidate.source_entity_id)?.entity_name || null,
        counterparty_entity_name: scopeByEntity.get(candidate.counterparty_entity_id)?.entity_name || null,
        canonical_key: candidate.debit_canonical_key, statement_code: validation.statementCode, logical_key: validation.logicalKey,
        updated_by: user.email, updated_at: new Date().toISOString(),
      });
      if (current.status === 'approved') Object.assign(updates, { status: 'draft', approved_by: null, approved_at: null });
      const entry = await base44.asServiceRole.entities.FinancialConsolidationEntry.update(current.id, updates);
      return Response.json({ success: true, requires_reapproval: current.status === 'approved', entry });
    }

    if (action === 'delete') {
      if (!['draft','pending_review'].includes(current.status)) return Response.json({ error: `Status ${current.status} não permite exclusão` }, { status: 400 });
      await base44.asServiceRole.entities.FinancialConsolidationEntry.delete(current.id);
      return Response.json({ success: true });
    }

    if (action === 'submit') {
      if (current.status !== 'draft') return Response.json({ error: 'Apenas draft pode ser submetido' }, { status: 400 });
      const validation = await validateEntry(current, current.id);
      if (!validation.valid) return Response.json({ error: validation.errors[0]?.code, errors: validation.errors }, { status: 400 });
      const normalizedJustification = String(current.justification ?? current.rationale ?? '').trim();
      const entry = await base44.asServiceRole.entities.FinancialConsolidationEntry.update(current.id, { status: 'pending_review', rationale: normalizedJustification, justification: normalizedJustification });
      return Response.json({ success: true, entry });
    }

    if (action === 'approve') {
      if (current.status !== 'pending_review') return Response.json({ error: 'Apenas pending_review pode ser aprovada' }, { status: 400 });
      const validation = await validateEntry(current, current.id);
      if (!validation.valid) return Response.json({ error: validation.errors[0]?.code, errors: validation.errors }, { status: 400 });
      const normalizedJustification = String(current.justification ?? current.rationale ?? '').trim();
      const entry = await base44.asServiceRole.entities.FinancialConsolidationEntry.update(current.id, { status: 'approved', rationale: normalizedJustification, justification: normalizedJustification, approved_by: user.email, approved_at: new Date().toISOString() });
      return Response.json({ success: true, entry });
    }

    if (action === 'post') {
      if (current.status !== 'approved') return Response.json({ error: 'Apenas approved pode ser posted' }, { status: 400 });
      const fresh = await base44.asServiceRole.entities.FinancialConsolidationEntry.get(current.id);
      const validation = await validateEntry(fresh, fresh.id);
      if (!validation.valid) return Response.json({ error: validation.errors[0]?.code, errors: validation.errors }, { status: 400 });
      const normalizedJustification = String(fresh.justification ?? fresh.rationale ?? '').trim();
      const entry = await base44.asServiceRole.entities.FinancialConsolidationEntry.update(fresh.id, { status: 'posted', rationale: normalizedJustification, justification: normalizedJustification });
      return Response.json({ success: true, entry });
    }

    if (action === 'reverse_to_draft') {
      if (current.status !== 'approved') return Response.json({ error: 'Apenas approved pode voltar a draft' }, { status: 400 });
      const entry = await base44.asServiceRole.entities.FinancialConsolidationEntry.update(current.id, { status: 'draft', approved_by: null, approved_at: null });
      return Response.json({ success: true, entry });
    }

    if (current.status !== 'posted') return Response.json({ error: 'Apenas posted pode ser revertida' }, { status: 400 });
    if (!body.reversal_reason?.trim()) return Response.json({ error: 'reversal_reason obrigatório' }, { status: 400 });
    const entry = await base44.asServiceRole.entities.FinancialConsolidationEntry.update(current.id, { status: 'reversed', reversed_at: new Date().toISOString(), reversal_reason: body.reversal_reason.trim() });
    return Response.json({ success: true, entry });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});