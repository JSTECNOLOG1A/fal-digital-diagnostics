/**
 * getFinancialJourneyState — Fonte canônica do estado da jornada financeira (F2-JRN-01).
 *
 * v2 (RESIDUAL 1):
 *   - Falha fechada: erros de leitura de entidades críticas retornam 503, NÃO arrays vazios.
 *   - Integridade única: LÊ o resultado persistido por checkFinancialDiagnosisIntegrity;
 *     não computa uma segunda versão reduzida que sobrescreveria a completa.
 *   - Freshness: confere integrity_checked_at >= latest_processing_run.completed_at.
 *   - Contagem correta: receivedExpectedPairs = received ∩ expected (não "4 de 3").
 *
 * Payload: { financial_diagnosis_id }
 * Resposta: estado canônico com steps, current_step, integrity e can_open_analysis.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

const JOURNEY_BY_ANALYSIS_TYPE = {
  individual:   ['estrutura', 'fontes', 'validacao', 'analise'],
  combined:     ['estrutura', 'fontes', 'conciliacao', 'cedula', 'combinacao', 'validacao', 'analise'],
  consolidated: ['estrutura', 'fontes', 'conciliacao', 'cedula', 'preparacao', 'validacao', 'analise'],
};

const STEP_LABELS = {
  estrutura: 'Estrutura', fontes: 'Fontes', combinacao: 'Combinação',
  conciliacao: 'Conciliação', cedula: 'Cédula', preparacao: 'Preparação',
  validacao: 'Validação', analise: 'Análise',
};

const TERMINAL_PROCESSED = new Set(['processed', 'reviewed', 'approved']);

// Entidades críticas — falha de leitura deve retornar 503, NÃO array vazio
const CRITICAL_ENTITIES = new Set([
  'FinancialUpload', 'FinancialAnalysisScopeEntity', 'FinancialValidationResult',
  'FinancialPreparationRun', 'FinancialStatementLine', 'FinancialIndicatorSnapshot',
]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const { financial_diagnosis_id } = await req.json();
    if (!financial_diagnosis_id) {
      return Response.json({ error: 'financial_diagnosis_id é obrigatório' }, { status: 400 });
    }

    const diagnosis = await base44.asServiceRole.entities.FinancialDiagnosis.get(financial_diagnosis_id);
    if (!diagnosis) return Response.json({ error: 'Diagnóstico não encontrado' }, { status: 404 });
    if (appRole !== 'hq_admin' && diagnosis.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden: diagnóstico não pertence ao seu tenant' }, { status: 403 });
    }

    // ── F2-JRN-01: Ler posição de navegação POR USUÁRIO (FinancialJourneyPosition) ──
    // NÃO executa mutation dentro de getFinancialJourneyState.
    let savedStep = null;
    try {
      const positions = await base44.asServiceRole.entities.FinancialJourneyPosition.filter(
        { financial_diagnosis_id, user_id: user.id },
        '-updated_at',
        10
      );
      savedStep = positions[0]?.step || null;
    } catch (e) {
      console.warn('[getJourneyState] erro ao ler FinancialJourneyPosition:', e.message);
      // Non-critical — fall through to canonical step
    }

    const analysisType = diagnosis.analysis_type || 'individual';
    const isMultiEntity = analysisType !== 'individual';
    const stepKeys = JOURNEY_BY_ANALYSIS_TYPE[analysisType] || JOURNEY_BY_ANALYSIS_TYPE.individual;

    const qDiag = { financial_diagnosis_id };

    // ── Falha fechada: erros de leitura de entidades críticas retornam 503 ──
    const fetchAll = async (entityName, query, sort, limit) => {
      try {
        return await base44.asServiceRole.entities[entityName].filter(query, sort || 'id', limit || 5000);
      } catch (e) {
        console.error(`[getJourneyState] erro ao ler ${entityName}:`, e.message);
        if (CRITICAL_ENTITIES.has(entityName)) {
          throw { code: 'JOURNEY_SOURCE_UNAVAILABLE', entity: entityName, message: e.message };
        }
        return [];
      }
    };

    let scopeEntities, uploads, validations, preparationRuns;
    let reconciliations, consolidationEntries, stmtLines, indicators, preparedLines;
    let processingRuns;

    try {
      [
        scopeEntities, uploads, validations, preparationRuns,
        reconciliations, consolidationEntries, stmtLines, indicators, preparedLines,
        processingRuns,
      ] = await Promise.all([
        fetchAll('FinancialAnalysisScopeEntity', { ...qDiag, is_active: true }, 'id', 500),
        fetchAll('FinancialUpload', qDiag, '-created_date', 500),
        fetchAll('FinancialValidationResult', qDiag, 'id', 5000),
        fetchAll('FinancialPreparationRun', qDiag, '-run_number', 100),
        fetchAll('FinancialIntercompanyReconciliation', qDiag, 'id', 500),
        fetchAll('FinancialConsolidationEntry', qDiag, 'entry_number', 500),
        fetchAll('FinancialStatementLine', qDiag, 'id', 5000),
        fetchAll('FinancialIndicatorSnapshot', qDiag, 'id', 5000),
        fetchAll('PreparedFinancialDatasetLine', qDiag, 'id', 5000),
        fetchAll('FinancialProcessingRun', qDiag, '-started_at', 200),
      ]);
    } catch (e) {
      if (e?.code === 'JOURNEY_SOURCE_UNAVAILABLE') {
        return Response.json({
          error: 'JOURNEY_SOURCE_UNAVAILABLE',
          entity: e.entity,
          message: `Fonte de dados indisponível: ${e.entity}`,
        }, { status: 503 });
      }
      throw e;
    }

    // ── Helper: normalize period to year ──
    const yearOf = (p) => (p ? String(p).slice(0, 4) : null);
    const resolvePeriod = (u) => {
      if (u.source_period) return u.source_period;
      try { return JSON.parse(u.notes || '{}').period_override || null; } catch { return null; }
    };
    const normalizePeriod = (p) => p ? String(p).replace(/[^0-9-]/g, '').slice(0, 7) : null;

    // ── Only active uploads (is_current=true, status validated|processed) ──
    const activeUploads = uploads.filter((u) =>
      u.is_current !== false && ['validated', 'processed'].includes(u.upload_status)
    );

    // ── Expected years ──
    const expectedYears = (() => {
      const fp = diagnosis.first_period, lp = diagnosis.last_period;
      if (!fp || !lp) return [];
      const sy = parseInt(String(fp).slice(0, 4), 10), ey = parseInt(String(lp).slice(0, 4), 10);
      if (!sy || !ey || ey < sy) return [];
      const ys = []; for (let y = sy; y <= ey; y++) ys.push(String(y)); return ys;
    })();

    // ── Step: Estrutura ──
    const estruturaBlocking = [];
    if (isMultiEntity) {
      if (scopeEntities.length === 0) estruturaBlocking.push('Nenhuma entidade no escopo definida');
      if (analysisType === 'consolidated' && !diagnosis.parent_entity_id) estruturaBlocking.push('parent_entity_id não definido para consolidação');
      if (analysisType === 'combined' && !diagnosis.presenting_entity_id && scopeEntities.length > 1) {
        estruturaBlocking.push('presenting_entity_id não definido para combinação multi-entidade');
      }
    } else {
      if (!(diagnosis.company_id || diagnosis.unit_id || diagnosis.group_id)) estruturaBlocking.push('Entidade (company_id/unit_id/group_id) não definida');
    }
    if (!diagnosis.account_plan_id) estruturaBlocking.push('account_plan_id não definido');
    if (!diagnosis.first_period || !diagnosis.last_period) estruturaBlocking.push('Períodos não definidos');
    const estruturaDone = estruturaBlocking.length === 0;

    // ── Step: Fontes ──
    const fontesBlocking = [];
    // 3.5: Contagem correta — receivedPairs deve ser filtrado por expectedPairs
    const receivedPairsRaw = new Set();
    const receivedEntityIds = new Set();
    for (const u of activeUploads) {
      if (!u.source_entity_id && isMultiEntity) continue;
      if (u.source_entity_id) receivedEntityIds.add(u.source_entity_id);
      const y = yearOf(resolvePeriod(u));
      if (y && u.source_entity_id) receivedPairsRaw.add(`${u.source_entity_id}|${y}`);
    }
    const expectedPairs = new Set();
    if (isMultiEntity && expectedYears.length > 0) {
      for (const s of scopeEntities) for (const y of expectedYears) expectedPairs.add(`${s.entity_id}|${y}`);
    }
    // 3.5: receivedExpectedPairs = received ∩ expected
    const receivedExpectedPairs = new Set([...receivedPairsRaw].filter((p) => expectedPairs.has(p)));
    const missingPairs = [...expectedPairs].filter((p) => !receivedPairsRaw.has(p));
    const unexpectedPairs = [...receivedPairsRaw].filter((p) => !expectedPairs.has(p));

    let fontesDone = false;
    if (!estruturaDone) {
      fontesBlocking.push('Estrutura incompleta');
    } else if (!isMultiEntity) {
      fontesDone = activeUploads.length > 0;
      if (!fontesDone) fontesBlocking.push('Nenhum upload ativo (validated/processed)');
    } else {
      if (expectedPairs.size > 0) {
        fontesDone = missingPairs.length === 0;
        if (!fontesDone) fontesBlocking.push(`${missingPairs.length} par(es) entidade × período pendente(s)`);
        if (unexpectedPairs.length > 0) fontesBlocking.push(`${unexpectedPairs.length} par(es) fora do escopo esperado`);
      } else {
        const missingEntities = scopeEntities.filter((s) => !receivedEntityIds.has(s.entity_id));
        fontesDone = missingEntities.length === 0;
        if (!fontesDone) fontesBlocking.push(`${missingEntities.length} entidade(s) sem upload`);
      }
    }

    // ── Duplicate upload check (entity × period, normalized) ──
    const epMap = {};
    for (const u of uploads) {
      if (!u.source_entity_id || u.is_current === false) continue;
      const p = normalizePeriod(resolvePeriod(u));
      if (!p) continue;
      const k = `${u.source_entity_id}|${p}`;
      epMap[k] = (epMap[k] || 0) + 1;
    }
    const dupUploads = Object.values(epMap).filter((c) => c > 1).length;
    if (dupUploads > 0) fontesBlocking.push(`${dupUploads} duplicidade(s) de upload ativo (entidade × período)`);

    // ── Step: Combinação (combined only) ──
    const activeRuns = preparationRuns.filter((r) => !r.superseded_by_run_id && r.status !== 'superseded');
    const hasRun = (scope) => activeRuns.some((r) => r.dataset_scope === scope);
    let combinacaoDone = false;
    const combinacaoBlocking = [];
    if (analysisType === 'combined') {
      if (!cedulaDone) combinacaoBlocking.push('Cédula incompleta');
      else {
        combinacaoDone = hasRun('combined');
        if (!combinacaoDone) combinacaoBlocking.push('Nenhum preparation run combined ativo');
      }
    }

    // ── Step: Conciliação (consolidated only) ──
    const divergences = reconciliations.filter(
      (r) => r.status !== 'resolved' && Math.abs(r.difference_amount || 0) > 0.01
    ).length;
    let conciliacaoDone = false;
    const conciliacaoBlocking = [];
    if (analysisType === 'consolidated' || analysisType === 'combined') {
      if (!fontesDone) conciliacaoBlocking.push('Fontes incompletas');
      else {
        conciliacaoDone = divergences === 0;
        if (!conciliacaoDone) conciliacaoBlocking.push(`${divergences} divergência(s) de conciliação não resolvida(s)`);
      }
    }

    // ── Step: Cédula (consolidated only) ──
    const pendingEntries = consolidationEntries.filter(
      (e) => ['draft', 'pending_review'].includes(e.status)
    ).length;
    let cedulaDone = false;
    const cedulaBlocking = [];
    if (analysisType === 'consolidated' || analysisType === 'combined') {
      if (!conciliacaoDone) cedulaBlocking.push('Conciliação incompleta');
      else {
        cedulaDone = pendingEntries === 0;
        if (!cedulaDone) cedulaBlocking.push(`${pendingEntries} cédula(s) pendente(s) de aprovação`);
      }
    }

    // ── Step: Preparação (consolidated only) ──
    let preparacaoDone = false;
    const preparacaoBlocking = [];
    if (analysisType === 'consolidated') {
      if (!cedulaDone) preparacaoBlocking.push('Cédula incompleta');
      else {
        preparacaoDone = hasRun('parent') && hasRun('consolidated');
        if (!preparacaoDone) preparacaoBlocking.push('Preparation runs parent/consolidated não ativos');
      }
    }

    // ── Pre-validação done depends on analysis type ──
    const preValidacaoDone = analysisType === 'combined' ? combinacaoDone
      : analysisType === 'consolidated' ? preparacaoDone
      : fontesDone;

    // ── Step: Validação ──
    const blockingValidations = validations.filter((v) => v.severity === 'blocking' || v.blocking).length;
    let validacaoDone = false;
    const validacaoBlocking = [];
    if (!preValidacaoDone) {
      validacaoBlocking.push('Etapa anterior não concluída');
    } else {
      validacaoDone = blockingValidations === 0 && validations.length > 0;
      if (blockingValidations > 0) validacaoBlocking.push(`${blockingValidations} validação(ões) bloqueante(s)`);
      if (validations.length === 0) validacaoBlocking.push('Nenhuma validação executada');
    }

    // ════════════════════════════════════════════════════════════════════════════
    // F2-INT-01: UMA ÚNICA INTEGRIDADE
    // getFinancialJourneyState NÃO computa uma segunda versão reduzida da auditoria.
    // LÊ o resultado persistido por checkFinancialDiagnosisIntegrity no diagnóstico.
    // Confere freshness: integrity_checked_at >= latest_processing_run.completed_at.
    // ════════════════════════════════════════════════════════════════════════════
    const latestRun = processingRuns
      .filter((r) => r.completed_at)
      .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))[0];
    const latestRunCompletedAt = latestRun?.completed_at || null;
    const integrityCheckedAt = diagnosis.integrity_checked_at || null;

    let integrityStatus = diagnosis.integrity_status || 'unknown';
    let integrityBlockingCount = diagnosis.integrity_blocking_count || 0;
    let integrityWarningCount = diagnosis.integrity_warning_count || 0;
    let integrityFresh = true;
    let integrityBlockingIssues = [];
    let integrityWarnings = [];

    // Freshness check: se houver um run mais recente que o último integrity check,
    // a integridade está stale → deve ser revalidada
    if (latestRunCompletedAt && integrityCheckedAt && latestRunCompletedAt > integrityCheckedAt) {
      integrityFresh = false;
      integrityStatus = 'unknown';
      integrityBlockingIssues = ['Integridade desatualizada — execute checkFinancialDiagnosisIntegrity'];
    }

    // Se a integridade está stale ou unknown, e há outputs/runs, marcar como blocked
    if (!integrityFresh) {
      integrityStatus = 'blocked';
      integrityBlockingCount = 1;
    }

    // ── Step: Análise ──
    const hasOutputs = stmtLines.length > 0 || indicators.length > 0;
    let analiseDone = false;
    const analiseBlocking = [];
    if (!validacaoDone) {
      analiseBlocking.push('Validação não concluída');
    } else if (!hasOutputs) {
      analiseBlocking.push('Nenhum output financeiro (StatementLine/IndicatorSnapshot)');
    } else if (integrityStatus === 'blocked') {
      analiseBlocking.push(`Integridade bloqueada (${integrityBlockingCount} issue(s))`);
    } else if (!integrityFresh) {
      analiseBlocking.push('Integridade desatualizada — revalide antes de analisar');
    } else if (!TERMINAL_PROCESSED.has(diagnosis.status)) {
      analiseBlocking.push(`Diagnóstico não está em processed/reviewed/approved (atual: ${diagnosis.status})`);
    } else {
      analiseDone = true;
    }

    // ── Build steps array ──
    const stepBlocking = {
      estrutura: estruturaBlocking,
      fontes: fontesBlocking,
      combinacao: combinacaoBlocking,
      conciliacao: conciliacaoBlocking,
      cedula: cedulaBlocking,
      preparacao: preparacaoBlocking,
      validacao: validacaoBlocking,
      analise: analiseBlocking,
    };
    const stepDone = {
      estrutura: estruturaDone,
      fontes: fontesDone,
      combinacao: combinacaoDone,
      conciliacao: conciliacaoDone,
      cedula: cedulaDone,
      preparacao: preparacaoDone,
      validacao: validacaoDone,
      analise: analiseDone,
    };

    // ── Compute current_step and last_valid_step ──
    let firstNotDoneIdx = stepKeys.findIndex((k) => !stepDone[k]);
    if (firstNotDoneIdx === -1) firstNotDoneIdx = stepKeys.length - 1;
    let currentStepIdx = firstNotDoneIdx;
    if (stepKeys[currentStepIdx] === 'analise' && !stepDone.analise) {
      currentStepIdx = Math.max(0, currentStepIdx - 1);
    }
    const currentStep = stepKeys[currentStepIdx];
    const lastValidStep = stepKeys[Math.max(0, currentStepIdx)];

    // ── Build steps with status ──
    const steps = stepKeys.map((key, i) => {
      const done = stepDone[key];
      let status = 'pending';
      if (done) status = 'done';
      else if (i === currentStepIdx) status = 'current';
      else if (i > currentStepIdx) status = 'blocked';
      const accessible = i <= currentStepIdx;
      let detail = '';
      if (key === 'fontes') {
        // 3.5: Exibir receivedExpectedPairs.size de expectedPairs.size (não "4 de 3")
        detail = isMultiEntity
          ? (expectedPairs.size > 0 ? `${receivedExpectedPairs.size} de ${expectedPairs.size} pares` : `${receivedEntityIds.size} de ${scopeEntities.length} ent.`)
          : `${activeUploads.length} upload(s) ativo(s)`;
      } else if (key === 'estrutura') {
        detail = isMultiEntity ? `${scopeEntities.length} entidade(s)` : (estruturaDone ? 'entidade definida' : 'pendente');
      } else if (key === 'validacao') {
        detail = blockingValidations > 0 ? `${blockingValidations} bloqueante(s)` : (validations.length > 0 ? 'ok' : 'aguardando');
      } else if (key === 'analise') {
        detail = analiseDone ? 'concluída' : hasOutputs ? 'outputs prontos' : 'pendente';
      } else {
        detail = done ? 'concluída' : 'pendente';
      }
      return {
        key,
        label: STEP_LABELS[key] || key,
        status,
        accessible,
        completed: done,
        detail,
        blocking_reasons: stepBlocking[key] || [],
      };
    });

    const canOpenAnalysis = validacaoDone && hasOutputs && integrityStatus !== 'blocked' && integrityFresh && TERMINAL_PROCESSED.has(diagnosis.status);

    // ── F2-JRN-01: resolved_active_step = savedStep se acessível, senão currentStep ──
    const savedStepObject = stepKeys.includes(savedStep)
      ? steps.find((item) => item.key === savedStep)
      : null;
    const resolvedActiveStep = savedStepObject?.accessible ? savedStep : currentStep;

    // 9 (RESIDUAL 2): getFinancialJourneyState é SOMENTE LEITURA.
    // NÃO executa FinancialDiagnosis.update — last_active_step agora é por usuário
    // (FinancialJourneyPosition), persistido por updateFinancialJourneyPosition.

    return Response.json({
      financial_diagnosis_id,
      analysis_type: analysisType,
      current_step: currentStep,
      saved_user_step: savedStep,
      resolved_active_step: resolvedActiveStep,
      last_valid_step: lastValidStep,
      can_open_analysis: canOpenAnalysis,
      integrity: {
        status: integrityStatus,
        blocking_count: integrityBlockingCount,
        warning_count: integrityWarningCount,
        blocking_issues: integrityBlockingIssues,
        warnings: integrityWarnings,
        checked_at: integrityCheckedAt,
        fresh: integrityFresh,
        latest_run_completed_at: latestRunCompletedAt,
      },
      steps,
      diagnosis_status: diagnosis.status,
      fontes_detail: {
        received_expected_pairs: receivedExpectedPairs.size,
        expected_pairs: expectedPairs.size,
        missing_pairs: missingPairs,
        unexpected_pairs: unexpectedPairs,
        duplicate_uploads: dupUploads,
      },
    });
  } catch (error) {
    console.error('[getJourneyState] erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});