import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
const SCOPE_FIELDS = ['entity_id', 'entity_type', 'entity_name', 'role', 'direct_ownership_pct', 'voting_rights_pct', 'control_type', 'consolidation_method'];

function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

function scopePayload(row, tenantId, diagnosisId) {
  return {
    tenant_id: tenantId,
    financial_diagnosis_id: diagnosisId,
    is_active: true,
    entity_id: row.entity_id,
    entity_type: row.entity_type || 'company',
    entity_name: row.entity_name || '',
    role: row.role || 'analyzed_entity',
    direct_ownership_pct: row.direct_ownership_pct ?? null,
    voting_rights_pct: row.voting_rights_pct ?? null,
    control_type: row.control_type || 'none',
    consolidation_method: row.consolidation_method || 'not_applicable',
  };
}

function sameScope(actual, expected) {
  return SCOPE_FIELDS.every((field) => (actual[field] ?? null) === (expected[field] ?? null));
}

Deno.serve(async (req) => {
  let base44 = null;
  let diagnosisId = null;
  let previousDiagnosis = null;
  let previousScope = [];
  let previousScopeIds = [];
  const createdScopeIds = [];
  let mutationStarted = false;
  try {
    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });
    const appRole = resolveAppRole(user);
    if (!WRITE_ROLES.has(appRole)) return Response.json({ error: 'Forbidden: write permission required' }, { status: 403 });

    const body = await req.json();
    diagnosisId = body.financial_diagnosis_id;
    const definition = body.definition;
    const scopeEntities = Array.isArray(body.scope_entities) ? body.scope_entities : [];
    if (!diagnosisId || !definition || typeof definition !== 'object') return Response.json({ error: 'financial_diagnosis_id e definition são obrigatórios' }, { status: 400 });

    const diagnosis = await base44.asServiceRole.entities.FinancialDiagnosis.get(diagnosisId);
    if (!diagnosis) return Response.json({ error: 'Diagnóstico não encontrado' }, { status: 404 });
    if (appRole !== 'hq_admin' && diagnosis.tenant_id !== user.tenant_id) return Response.json({ error: 'Forbidden: diagnóstico não pertence ao seu tenant' }, { status: 403 });

    const analysisType = definition.analysis_type || diagnosis.analysis_type || 'individual';
    const issues = [];
    if (!definition.periodicidade) issues.push('periodicidade é obrigatório');
    if (!definition.account_plan_id && !diagnosis.account_plan_id) issues.push('account_plan_id é obrigatório');
    if (analysisType !== 'individual' && scopeEntities.length === 0) issues.push('Multi-entity requer scope_entities não vazio');
    if (analysisType === 'consolidated' && !definition.parent_entity_id) issues.push('Consolidated requer parent_entity_id');
    if (scopeEntities.some((row) => !row.entity_id || !row.role)) issues.push('Todo scope requer entity_id e role');
    if (issues.length) return Response.json({ error: 'Preflight falhou', issues }, { status: 400 });

    previousDiagnosis = { ...diagnosis };
    previousScope = await base44.asServiceRole.entities.FinancialAnalysisScopeEntity.filter({ financial_diagnosis_id: diagnosisId }, 'id', 500);
    previousScopeIds = previousScope.map((row) => row.id);
    const desiredScope = scopeEntities.map((row) => scopePayload(row, diagnosis.tenant_id, diagnosisId));
    const diagnosisUpdate = {
      analysis_type: analysisType,
      scope_level: definition.scope_level || diagnosis.scope_level,
      title: definition.title || diagnosis.title,
      company_id: definition.company_id ?? null,
      unit_id: definition.unit_id ?? null,
      parent_entity_id: definition.parent_entity_id ?? null,
      presenting_entity_id: definition.presenting_entity_id ?? null,
      periodicidade: definition.periodicidade,
      account_plan_id: definition.account_plan_id || diagnosis.account_plan_id,
      first_period: definition.first_period || diagnosis.first_period,
      last_period: definition.last_period || diagnosis.last_period,
      months_count: definition.months_count ?? diagnosis.months_count,
      data_base_abertura: definition.data_base_abertura ?? null,
      data_base_fechamento: definition.data_base_fechamento ?? null,
      client_profile_type: definition.client_profile_type ?? diagnosis.client_profile_type ?? null,
      sector: definition.sector ?? diagnosis.sector ?? null,
    };

    mutationStarted = true;
    await base44.asServiceRole.entities.FinancialDiagnosis.update(diagnosisId, diagnosisUpdate);

    const activeByEntity = new Map(previousScope.filter((row) => row.is_active !== false).map((row) => [row.entity_id, row]));
    const desiredIds = new Set(desiredScope.map((row) => row.entity_id));
    for (const row of previousScope.filter((item) => item.is_active !== false && !desiredIds.has(item.entity_id))) {
      await base44.asServiceRole.entities.FinancialAnalysisScopeEntity.update(row.id, { is_active: false });
    }
    for (const desired of desiredScope) {
      const existing = activeByEntity.get(desired.entity_id);
      if (existing) {
        await base44.asServiceRole.entities.FinancialAnalysisScopeEntity.update(existing.id, desired);
      } else {
        const created = await base44.asServiceRole.entities.FinancialAnalysisScopeEntity.create(desired);
        createdScopeIds.push(created.id);
      }
    }

    const persistedDiagnosis = await base44.asServiceRole.entities.FinancialDiagnosis.get(diagnosisId);
    const persistedScope = await base44.asServiceRole.entities.FinancialAnalysisScopeEntity.filter({ financial_diagnosis_id: diagnosisId, is_active: true }, 'id', 500);
    if (Object.entries(diagnosisUpdate).some(([key, value]) => (persistedDiagnosis[key] ?? null) !== (value ?? null))) throw new Error('Pós-condição falhou: diagnóstico divergente');
    if (persistedScope.length !== desiredScope.length || desiredScope.some((expected) => !persistedScope.some((actual) => sameScope(actual, expected)))) throw new Error('Pós-condição falhou: escopo divergente');

    const now = new Date().toISOString();
    const run = await base44.asServiceRole.entities.FinancialProcessingRun.create({
      tenant_id: diagnosis.tenant_id,
      financial_diagnosis_id: diagnosisId,
      operation_type: 'save_definition',
      operation_key: [diagnosis.tenant_id, diagnosisId, '', 'save_definition', '', '', now].join('|'),
      status: 'succeeded',
      started_at: now,
      completed_at: now,
      triggered_by: user.email,
      result_summary: { success: true, scope_entity_count: persistedScope.length, analysis_type: analysisType },
    });
    return Response.json({ success: true, run_id: run.id, financial_diagnosis_id: diagnosisId, scope_count: persistedScope.length });
  } catch (error) {
    let rollbackExecuted = false;
    let rollbackError = null;
    if (base44 && mutationStarted && diagnosisId && previousDiagnosis) {
      try {
        const diagnosisRestore = { ...previousDiagnosis };
        delete diagnosisRestore.id;
        delete diagnosisRestore.created_date;
        delete diagnosisRestore.updated_date;
        delete diagnosisRestore.created_by_id;
        await base44.asServiceRole.entities.FinancialDiagnosis.update(diagnosisId, diagnosisRestore);
        for (const createdId of createdScopeIds) await base44.asServiceRole.entities.FinancialAnalysisScopeEntity.update(createdId, { is_active: false });
        for (const previous of previousScope) {
          const restore = { ...previous };
          delete restore.id;
          delete restore.created_date;
          delete restore.updated_date;
          delete restore.created_by_id;
          await base44.asServiceRole.entities.FinancialAnalysisScopeEntity.update(previous.id, restore);
        }
        const diagnosisAfter = await base44.asServiceRole.entities.FinancialDiagnosis.get(diagnosisId);
        const scopeAfter = await base44.asServiceRole.entities.FinancialAnalysisScopeEntity.filter({ financial_diagnosis_id: diagnosisId }, 'id', 500);
        const diagnosisRestored = Object.keys(previousDiagnosis).filter((key) => !['id', 'created_date', 'updated_date', 'created_by_id'].includes(key)).every((key) => (diagnosisAfter[key] ?? null) === (previousDiagnosis[key] ?? null));
        const scopeRestored = previousScopeIds.every((id) => previousScope.some((expected) => expected.id === id && scopeAfter.some((actual) => actual.id === id && (actual.is_active ?? true) === (expected.is_active ?? true) && SCOPE_FIELDS.every((field) => (actual[field] ?? null) === (expected[field] ?? null))))) && createdScopeIds.every((id) => scopeAfter.some((row) => row.id === id && row.is_active === false));
        rollbackExecuted = diagnosisRestored && scopeRestored;
        if (!rollbackExecuted) rollbackError = 'releitura divergiu do estado anterior';
      } catch (rollbackFailure) {
        rollbackError = rollbackFailure.message;
      }
    }
    return Response.json({ error: error.message, rollback_executed: rollbackExecuted, rollback_error: rollbackError }, { status: 500 });
  }
});