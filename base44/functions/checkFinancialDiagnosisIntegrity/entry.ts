/**
 * checkFinancialDiagnosisIntegrity — v3 (RESIDUAL 2)
 *
 * F2-INT-01: Integridade fail-closed.
 *   - Erros de leitura de entidades críticas NÃO viram array vazio. Lançam
 *     { code: 'INTEGRITY_SOURCE_UNAVAILABLE', entity, message } → HTTP 503.
 *   - Não persiste healthy/warning quando qualquer fonte crítica falhar.
 *   - Persiste integrity_status=blocked ou mantém último estado com fresh=false.
 *
 * 6. Mode parameter:
 *   - mode='full' (default): audita todo o diagnóstico, persiste resultado em FinancialDiagnosis.
 *   - mode='replacement_candidate': audita apenas o novo upload e seus outputs,
 *     usa o diagnóstico como contexto, NÃO considera coexistência old/new como duplicidade,
 *     NÃO persiste integridade global.
 *
 * Payload: { financial_diagnosis_id, upload_id?, mode? }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

const MAPPING_SOURCE_ENUM = ['client_specific', 'account_plan', 'excel_mapping', 'unmapped'];
const DATASET_SCOPE_ENUM = ['individual', 'combined', 'parent', 'consolidated'];
const RUN_STATUS_ENUM = ['draft', 'processing', 'prepared', 'validation_failed', 'approved', 'superseded'];
const ENTRY_STATUS_ENUM = ['draft', 'pending_review', 'approved', 'posted', 'reversed'];

// 5: Entidades críticas — falha de leitura retorna 503, NÃO array vazio
const CRITICAL_ENTITIES = new Set([
  'FinancialUpload', 'FinancialTrialBalanceLine', 'FinancialStatementLine',
  'FinancialIndicatorSnapshot', 'FinancialValidationResult', 'FinancialMappingResolution',
  'FinancialPreparationRun', 'PreparedFinancialDatasetLine', 'FinancialAnalysisScopeEntity',
]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const { financial_diagnosis_id, upload_id, mode = 'full' } = await req.json();
    if (!financial_diagnosis_id) {
      return Response.json({ error: 'financial_diagnosis_id é obrigatório' }, { status: 400 });
    }
    if (mode !== 'full' && mode !== 'replacement_candidate') {
      return Response.json({ error: `mode inválido: ${mode}` }, { status: 400 });
    }
    if (mode === 'full') {
      if (!WRITE_ROLES.has(appRole)) return Response.json({ error: 'Forbidden: write permission required' }, { status: 403 });
    }

    const diagnosis = await base44.asServiceRole.entities.FinancialDiagnosis.get(financial_diagnosis_id);
    if (!diagnosis) return Response.json({ error: 'Diagnóstico não encontrado' }, { status: 404 });
    if (appRole !== 'hq_admin' && diagnosis.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden: diagnóstico não pertence ao seu tenant' }, { status: 403 });
    }

    // ── 5: fetchAll fail-closed — entidades críticas lançam exceção em vez de retornar [] ──
    const fetchAll = async (entityName, query, sort, limit) => {
      try {
        return await base44.asServiceRole.entities[entityName].filter(query, sort || 'id', limit || 5000);
      } catch (e) {
        console.error(`[checkIntegrity] erro ao ler ${entityName}:`, e.message);
        if (CRITICAL_ENTITIES.has(entityName)) {
          throw { code: 'INTEGRITY_SOURCE_UNAVAILABLE', entity: entityName, message: e.message };
        }
        return [];
      }
    };

    const qDiag = { financial_diagnosis_id };

    let uploads, trialLines, stmtLines, indicators, validations;
    let mappings, alerts, findings, recommendations, actionProposals;
    let reportVersions, adjustments, adjustmentEntries;
    let dfcCompositionLines, dfcManualAdjustments, dfcClassificationOverrides;
    let preparationRuns, preparedDatasetLines, consolidationEntries;
    let intercompanyReconciliations, scopeEntities;

    try {
      [
        uploads, trialLines, stmtLines, indicators, validations,
        mappings, alerts, findings, recommendations, actionProposals,
        reportVersions, adjustments, adjustmentEntries,
        dfcCompositionLines, dfcManualAdjustments, dfcClassificationOverrides,
        preparationRuns, preparedDatasetLines, consolidationEntries,
        intercompanyReconciliations, scopeEntities,
      ] = await Promise.all([
        fetchAll('FinancialUpload', qDiag),
        fetchAll('FinancialTrialBalanceLine', qDiag),
        fetchAll('FinancialStatementLine', qDiag),
        fetchAll('FinancialIndicatorSnapshot', qDiag),
        fetchAll('FinancialValidationResult', qDiag),
        fetchAll('FinancialMappingResolution', qDiag),
        fetchAll('FinancialAlert', qDiag),
        fetchAll('FinancialFinding', qDiag),
        fetchAll('FinancialRecommendation', qDiag),
        fetchAll('FinancialActionProposal', qDiag),
        fetchAll('FinancialReportVersion', qDiag),
        fetchAll('FinancialAdjustment', qDiag),
        fetchAll('FinancialAdjustmentEntry', qDiag),
        fetchAll('FinancialDfcCompositionLine', qDiag),
        fetchAll('FinancialDfcManualAdjustment', qDiag),
        fetchAll('FinancialDfcClassificationOverride', qDiag),
        fetchAll('FinancialPreparationRun', qDiag),
        fetchAll('PreparedFinancialDatasetLine', qDiag),
        fetchAll('FinancialConsolidationEntry', qDiag),
        fetchAll('FinancialIntercompanyReconciliation', qDiag),
        fetchAll('FinancialAnalysisScopeEntity', qDiag),
      ]);
    } catch (e) {
      if (e?.code === 'INTEGRITY_SOURCE_UNAVAILABLE') {
        // 5: Retornar 503 — NÃO persistir healthy/warning
        return Response.json({
          error: 'INTEGRITY_SOURCE_UNAVAILABLE',
          entity: e.entity,
          message: `Fonte de dados crítica indisponível: ${e.entity}`,
          detail: e.message,
        }, { status: 503 });
      }
      throw e;
    }

    // Uploads em deleção recuperável não participam da visão produtiva de integridade.
    uploads = uploads.filter((upload) => !['pending_delete', 'tombstoned'].includes(upload.deletion_status));

    // ════════════════════════════════════════════════════════════════
    // MODE: replacement_candidate
    // 6: Auditar apenas o novo upload e seus outputs.
    //    Não considera coexistência old/new como duplicidade.
    //    Não persiste integridade global.
    // ════════════════════════════════════════════════════════════════
    if (mode === 'replacement_candidate' && upload_id) {
      const candidateUpload = uploads.find((u) => u.id === upload_id);
      if (!candidateUpload) {
        return Response.json({
          mode: 'replacement_candidate',
          candidate_upload_id: upload_id,
          candidate_is_healthy: false,
          blocking_issues: ['Upload candidato não encontrado no diagnóstico'],
          output_counts: {},
        }, { status: 404 });
      }

      const candidateStmtLines = stmtLines.filter((l) => l.financial_upload_id === upload_id);
      const candidateIndicators = indicators.filter((i) => i.financial_upload_id === upload_id);
      const candidateValidations = validations.filter((v) => v.financial_upload_id === upload_id);
      const candidateMappings = mappings.filter((m) => m.financial_upload_id === upload_id);
      const candidateTrialLines = trialLines.filter((t) => t.financial_upload_id === upload_id);

      const candidateBlocking = [];
      const candidateWarnings = [];

      // Critérios: novo upload existe, statement lines > 0, validations blocking = 0,
      // chaves canônicas sem duplicidade interna, entidade e período coerentes
      if (candidateStmtLines.length === 0) {
        candidateBlocking.push('Candidato não possui StatementLines');
      }
      const blockingValidations = candidateValidations.filter((v) => v.severity === 'blocking' || v.blocking);
      if (blockingValidations.length > 0) {
        candidateBlocking.push(`${blockingValidations.length} validação(ões) bloqueante(s) no candidato`);
      }

      // Duplicidade interna de chaves canônicas (mesmo upload, mesmo período, mesmo canonical_key)
      const seenKeys = new Set();
      let internalDupes = 0;
      for (const l of candidateStmtLines) {
        const k = `${l.period}|${l.column_key || ''}|${l.statement_code}|${l.canonical_key}|${l.entity_code}`;
        if (seenKeys.has(k)) internalDupes++;
        else seenKeys.add(k);
      }
      if (internalDupes > 0) {
        candidateBlocking.push(`${internalDupes} duplicidade(s) interna(s) de chaves canônicas no candidato`);
      }

      // Entidade e período coerentes com o upload
      if (!candidateUpload.source_entity_id && diagnosis.analysis_type !== 'individual') {
        candidateBlocking.push('Candidato sem source_entity_id (obrigatório para multi-entidade)');
      }

      const candidateIsHealthy = candidateBlocking.length === 0;

      return Response.json({
        mode: 'replacement_candidate',
        candidate_upload_id: upload_id,
        candidate_is_healthy: candidateIsHealthy,
        blocking_issues: candidateBlocking,
        warnings: candidateWarnings,
        output_counts: {
          statement_lines: candidateStmtLines.length,
          indicator_snapshots: candidateIndicators.length,
          validation_results: candidateValidations.length,
          mapping_resolutions: candidateMappings.length,
          trial_balance_lines: candidateTrialLines.length,
        },
      });
    }

    // ════════════════════════════════════════════════════════════════
    // MODE: full — auditoria completa do diagnóstico
    // ════════════════════════════════════════════════════════════════

    const uploadIds = new Set(uploads.map((u) => u.id));
    const runIds = new Set(preparationRuns.map((r) => r.id));

    const warnings = [];
    const blockingIssues = [];

    const orphanNoUpload = (items, label) => {
      const orphans = items.filter((i) => !i.financial_upload_id);
      if (orphans.length > 0) warnings.push(`${orphans.length} registro(s) de ${label} sem financial_upload_id.`);
      return orphans.length;
    };

    const linkedToMissingUpload = (items, label) => {
      const orphans = items.filter((i) => i.financial_upload_id && !uploadIds.has(i.financial_upload_id));
      if (orphans.length > 0) blockingIssues.push(`${orphans.length} registro(s) de ${label} vinculados a um upload que não existe mais.`);
      return orphans.length;
    };

    const trialLinesNoUpload = orphanNoUpload(trialLines, 'FinancialTrialBalanceLine');
    const stmtLinesNoUpload = orphanNoUpload(stmtLines, 'FinancialStatementLine');
    const indicatorsNoUpload = orphanNoUpload(indicators, 'FinancialIndicatorSnapshot');
    const validationsNoUpload = orphanNoUpload(validations, 'FinancialValidationResult');
    const mappingsNoUpload = orphanNoUpload(mappings, 'FinancialMappingResolution');
    const alertsNoUpload = orphanNoUpload(alerts, 'FinancialAlert');
    const dfcCompNoUpload = orphanNoUpload(dfcCompositionLines, 'FinancialDfcCompositionLine');

    const trialLinesMissingUpload = linkedToMissingUpload(trialLines, 'FinancialTrialBalanceLine');
    const stmtLinesMissingUpload = linkedToMissingUpload(stmtLines, 'FinancialStatementLine');
    const indicatorsMissingUpload = linkedToMissingUpload(indicators, 'FinancialIndicatorSnapshot');
    const validationsMissingUpload = linkedToMissingUpload(validations, 'FinancialValidationResult');
    const mappingsMissingUpload = linkedToMissingUpload(mappings, 'FinancialMappingResolution');
    const alertsMissingUpload = linkedToMissingUpload(alerts, 'FinancialAlert');

    const invalidMappingSource = mappings.filter((m) => m.mapping_source && !MAPPING_SOURCE_ENUM.includes(m.mapping_source));
    if (invalidMappingSource.length > 0) blockingIssues.push(`${invalidMappingSource.length} registro(s) de FinancialMappingResolution com mapping_source fora do enum permitido.`);

    if (findings.length > 0) warnings.push(`${findings.length} FinancialFinding vinculado(s) a este diagnóstico.`);
    if (recommendations.length > 0) warnings.push(`${recommendations.length} FinancialRecommendation vinculado(s) a este diagnóstico.`);
    if (actionProposals.length > 0) warnings.push(`${actionProposals.length} FinancialActionProposal vinculado(s) a este diagnóstico.`);
    if (reportVersions.length > 0) warnings.push(`${reportVersions.length} FinancialReportVersion vinculado(s) a este diagnóstico.`);

    if (adjustments.length > 0 || adjustmentEntries.length > 0) {
      warnings.push(`Existem ${adjustments.length} FinancialAdjustment e ${adjustmentEntries.length} FinancialAdjustmentEntry (manuais). Não são afetados por purges automáticos.`);
    }
    if (dfcManualAdjustments.length > 0) {
      warnings.push(`Existem ${dfcManualAdjustments.length} FinancialDfcManualAdjustment (ajustes manuais de DFC). Não são afetados por purges automáticos.`);
    }

    const seenLineKeys = new Set();
    let duplicateLines = 0;
    for (const l of stmtLines) {
      const key = `${l.financial_upload_id}|${l.period}|${l.column_key || ''}|${l.statement_code}|${l.canonical_key}|${l.entity_code}`;
      if (seenLineKeys.has(key)) duplicateLines++;
      else seenLineKeys.add(key);
    }
    if (duplicateLines > 0) warnings.push(`${duplicateLines} linha(s) duplicada(s) em FinancialStatementLine.`);

    const stmtLinesNoEntityCode = stmtLines.filter((l) => !l.entity_code).length;
    if (stmtLinesNoEntityCode > 0) warnings.push(`${stmtLinesNoEntityCode} linha(s) de FinancialStatementLine sem entity_code.`);
    const indicatorsNoEntityCode = indicators.filter((i) => !i.entity_code).length;
    if (indicatorsNoEntityCode > 0) warnings.push(`${indicatorsNoEntityCode} snapshot(s) de FinancialIndicatorSnapshot sem entity_code.`);

    // Multi-entity checks
    const isMultiEntity = diagnosis.analysis_type && diagnosis.analysis_type !== 'individual';
    const multiEntitySourceIssues = { uploads_no_source: 0, out_of_scope: 0, duplicate_entity_period: 0, approved_not_applied: 0, incomplete_entries: 0, equation_violations: 0, series_mix: 0, superseded_outputs: 0 };
    if (isMultiEntity) {
      const uploadsNoSource = uploads.filter((u) => !u.source_entity_id);
      multiEntitySourceIssues.uploads_no_source = uploadsNoSource.length;
      if (uploadsNoSource.length > 0) blockingIssues.push(`${uploadsNoSource.length} FinancialUpload sem source_entity_id.`);

      const scopeIds = new Set(scopeEntities.map((s) => s.entity_id));
      const outOfScope = uploads.filter((u) => u.source_entity_id && !scopeIds.has(u.source_entity_id));
      multiEntitySourceIssues.out_of_scope = outOfScope.length;
      if (outOfScope.length > 0) blockingIssues.push(`${outOfScope.length} FinancialUpload com source_entity_id fora do escopo.`);

      const epMap = {};
      for (const u of uploads) {
        if (!u.source_entity_id || u.is_current === false) continue;
        let p = u.source_period;
        if (!p) { try { p = JSON.parse(u.notes || '{}').period_override || null; } catch { p = null; } }
        if (!p) continue;
        const k = `${u.source_entity_id}|${p}`;
        epMap[k] = (epMap[k] || 0) + 1;
      }
      const dupCount = Object.values(epMap).filter((c) => c > 1).length;
      multiEntitySourceIssues.duplicate_entity_period = dupCount;
      if (dupCount > 0) blockingIssues.push(`${dupCount} duplicidade(s) entidade × período em FinancialUpload.`);

      const approvedNotApplied = consolidationEntries.filter((e) => ['approved', 'posted'].includes(e.status) && !e.preparation_run_id);
      multiEntitySourceIssues.approved_not_applied = approvedNotApplied.length;
      if (approvedNotApplied.length > 0) warnings.push(`${approvedNotApplied.length} FinancialConsolidationEntry aprovada/posted sem preparation_run_id.`);

      const incompleteEntries = consolidationEntries.filter((e) => !e.debit_canonical_key || !e.credit_canonical_key);
      multiEntitySourceIssues.incomplete_entries = incompleteEntries.length;
      if (incompleteEntries.length > 0) blockingIssues.push(`${incompleteEntries.length} FinancialConsolidationEntry com partida incompleta.`);

      const eqViolations = preparedDatasetLines.filter((l) => {
        const calc = (l.gross_value || 0) + (l.elimination_value || 0) + (l.adjustment_value || 0) + (l.reclassification_value || 0);
        return Math.abs(calc - (l.final_value || 0)) > 0.01;
      });
      multiEntitySourceIssues.equation_violations = eqViolations.length;
      if (eqViolations.length > 0) blockingIssues.push(`${eqViolations.length} PreparedFinancialDatasetLine com equação inconsistente.`);

      const stmtSeriesMix = {};
      for (const l of stmtLines) {
        const k = `${l.period}|${l.canonical_key}`;
        if (!stmtSeriesMix[k]) stmtSeriesMix[k] = new Set();
        stmtSeriesMix[k].add(`${l.dataset_scope}|${l.reporting_entity_id}`);
      }
      const mixedCount = Object.values(stmtSeriesMix).filter((s) => s.size > 1).length;
      multiEntitySourceIssues.series_mix = mixedCount;
      if (mixedCount > 0) warnings.push(`${mixedCount} StatementLine com mistura de séries.`);

      const supersededRunIds = new Set(preparationRuns.filter((r) => r.status === 'superseded').map((r) => r.id));
      const supersededOutputs = stmtLines.filter((l) => l.preparation_run_id && supersededRunIds.has(l.preparation_run_id));
      multiEntitySourceIssues.superseded_outputs = supersededOutputs.length;
      if (supersededOutputs.length > 0) warnings.push(`${supersededOutputs.length} StatementLine vinculada a run superseded.`);
    }

    // Preparation runs checks
    const runsInvalidStatus = preparationRuns.filter((r) => r.status && !RUN_STATUS_ENUM.includes(r.status));
    if (runsInvalidStatus.length > 0) blockingIssues.push(`${runsInvalidStatus.length} PreparationRun com status fora do enum permitido.`);
    const runsSupersededNoRef = preparationRuns.filter((r) => r.status === 'superseded' && !r.superseded_by_run_id);
    if (runsSupersededNoRef.length > 0) warnings.push(`${runsSupersededNoRef.length} PreparationRun com status 'superseded' mas sem superseded_by_run_id.`);
    const runsStuckProcessing = preparationRuns.filter((r) => r.status === 'processing');
    if (runsStuckProcessing.length > 0) warnings.push(`${runsStuckProcessing.length} PreparationRun em status 'processing'.`);

    const preparedNoRun = preparedDatasetLines.filter((l) => !l.preparation_run_id);
    if (preparedNoRun.length > 0) blockingIssues.push(`${preparedNoRun.length} PreparedFinancialDatasetLine sem preparation_run_id.`);
    const preparedOrphanRun = preparedDatasetLines.filter((l) => l.preparation_run_id && !runIds.has(l.preparation_run_id));
    if (preparedOrphanRun.length > 0) blockingIssues.push(`${preparedOrphanRun.length} PreparedFinancialDatasetLine vinculada a preparation_run_id inexistente.`);
    const preparedInvalidScope = preparedDatasetLines.filter((l) => l.dataset_scope && !DATASET_SCOPE_ENUM.includes(l.dataset_scope));
    if (preparedInvalidScope.length > 0) blockingIssues.push(`${preparedInvalidScope.length} PreparedFinancialDatasetLine com dataset_scope fora do enum permitido.`);

    // Consolidation entries checks
    const consEntriesNoPeriod = consolidationEntries.filter((e) => !e.period);
    if (consEntriesNoPeriod.length > 0) warnings.push(`${consEntriesNoPeriod.length} FinancialConsolidationEntry sem period.`);
    const consEntriesInvalidStatus = consolidationEntries.filter((e) => e.status && !ENTRY_STATUS_ENUM.includes(e.status));
    if (consEntriesInvalidStatus.length > 0) warnings.push(`${consEntriesInvalidStatus.length} FinancialConsolidationEntry com status fora do enum.`);
    const consEntriesPostedNoRun = consolidationEntries.filter((e) => e.status === 'posted' && !e.preparation_run_id);
    if (consEntriesPostedNoRun.length > 0) warnings.push(`${consEntriesPostedNoRun.length} FinancialConsolidationEntry com status 'posted' mas sem preparation_run_id.`);

    // Intercompany reconciliations
    const reconUnmatched = intercompanyReconciliations.filter((r) => r.status === 'unmatched');
    if (reconUnmatched.length > 0) warnings.push(`${reconUnmatched.length} FinancialIntercompanyReconciliation em status 'unmatched'.`);
    const reconNoEntity = intercompanyReconciliations.filter((r) => !r.entity_a_id || !r.entity_b_id);
    if (reconNoEntity.length > 0) warnings.push(`${reconNoEntity.length} FinancialIntercompanyReconciliation sem entity_a_id ou entity_b_id.`);

    // Scope entities
    const scopeNoEntityId = scopeEntities.filter((s) => !s.entity_id);
    if (scopeNoEntityId.length > 0) warnings.push(`${scopeNoEntityId.length} FinancialAnalysisScopeEntity sem entity_id.`);

    // DFC overrides
    const activeOverrides = dfcClassificationOverrides.filter((o) => o.status === 'active');
    if (activeOverrides.length > 0) warnings.push(`${activeOverrides.length} FinancialDfcClassificationOverride ativa(s).`);

    // byUpload summary
    let byUpload = null;
    if (upload_id) {
      const inUpload = (arr) => arr.filter((i) => i.financial_upload_id === upload_id).length;
      byUpload = {
        upload_exists: uploadIds.has(upload_id),
        trial_balance_lines: inUpload(trialLines),
        statement_lines: inUpload(stmtLines),
        indicator_snapshots: inUpload(indicators),
        validation_results: inUpload(validations),
        mapping_resolutions: inUpload(mappings),
        alerts: inUpload(alerts),
        dfc_composition_lines: inUpload(dfcCompositionLines),
      };
      if (!byUpload.upload_exists) blockingIssues.push(`upload_id informado (${upload_id}) não existe mais no FinancialUpload.`);
    }

    const byUploadSummary = uploads.map((u) => {
      const inUpload = (arr) => arr.filter((i) => i.financial_upload_id === u.id).length;
      return {
        upload_id: u.id, file_name: u.file_name, upload_status: u.upload_status,
        trial_balance_lines: inUpload(trialLines), statement_lines: inUpload(stmtLines),
        indicator_snapshots: inUpload(indicators), validation_results: inUpload(validations),
        mapping_resolutions: inUpload(mappings), alerts: inUpload(alerts),
        dfc_composition_lines: inUpload(dfcCompositionLines),
      };
    });

    const byRunSummary = preparationRuns.map((r) => {
      const inRun = (arr) => arr.filter((i) => i.preparation_run_id === r.id).length;
      return {
        run_id: r.id, run_number: r.run_number, analysis_type: r.analysis_type,
        dataset_scope: r.dataset_scope, status: r.status, source_count: r.source_count,
        prepared_line_count: r.prepared_line_count, prepared_lines_in_db: inRun(preparedDatasetLines),
        consolidation_entries_in_db: consolidationEntries.filter((e) => e.preparation_run_id === r.id).length,
        reconciliations_in_db: intercompanyReconciliations.filter((rc) => rc.preparation_run_id === r.id).length,
      };
    });

    const findingsSummary = {
      total: findings.length,
      auto_generated: findings.filter((f) => f.origin === 'auto_interpretation').length,
      manual: findings.filter((f) => f.origin !== 'auto_interpretation').length,
    };

    // ── Persistir integridade no diagnóstico (somente mode=full) ──
    const integrityStatus = blockingIssues.length > 0 ? 'blocked'
      : warnings.length > 0 ? 'warning'
      : (uploads.length > 0 || stmtLines.length > 0) ? 'healthy'
      : 'unknown';
    const checkedAt = new Date().toISOString();

    // 5: Não persistir healthy/warning quando fonte crítica falhou — já retornou 503 acima.
    // Aqui chegamos apenas se todas as fontes críticas foram lidas com sucesso.
    try {
      await base44.asServiceRole.entities.FinancialDiagnosis.update(financial_diagnosis_id, {
        integrity_status: integrityStatus,
        integrity_blocking_count: blockingIssues.length,
        integrity_warning_count: warnings.length,
        integrity_checked_at: checkedAt,
      });
    } catch (e) {
      console.warn('[checkIntegrity] erro ao persistir integridade:', e.message);
    }

    const result = {
      financial_diagnosis_id,
      upload_id: upload_id || null,
      mode: 'full',
      findings_summary: findingsSummary,
      counts: {
        uploads: uploads.length,
        trial_balance_lines: trialLines.length,
        statement_lines: stmtLines.length,
        indicator_snapshots: indicators.length,
        validation_results: validations.length,
        mapping_resolutions: mappings.length,
        alerts: alerts.length,
        findings: findings.length,
        recommendations: recommendations.length,
        action_proposals: actionProposals.length,
        report_versions: reportVersions.length,
        adjustments: adjustments.length,
        adjustment_entries: adjustmentEntries.length,
        dfc_composition_lines: dfcCompositionLines.length,
        dfc_manual_adjustments: dfcManualAdjustments.length,
        dfc_classification_overrides: dfcClassificationOverrides.length,
        preparation_runs: preparationRuns.length,
        prepared_dataset_lines: preparedDatasetLines.length,
        consolidation_entries: consolidationEntries.length,
        intercompany_reconciliations: intercompanyReconciliations.length,
        scope_entities: scopeEntities.length,
      },
      orphans_no_upload_id: {
        trial_balance_lines: trialLinesNoUpload,
        statement_lines: stmtLinesNoUpload,
        indicator_snapshots: indicatorsNoUpload,
        validation_results: validationsNoUpload,
        mapping_resolutions: mappingsNoUpload,
        alerts: alertsNoUpload,
        dfc_composition_lines: dfcCompNoUpload,
      },
      linked_to_missing_upload: {
        trial_balance_lines: trialLinesMissingUpload,
        statement_lines: stmtLinesMissingUpload,
        indicator_snapshots: indicatorsMissingUpload,
        validation_results: validationsMissingUpload,
        mapping_resolutions: mappingsMissingUpload,
        alerts: alertsMissingUpload,
      },
      multi_entity: {
        preparation_runs: {
          total: preparationRuns.length,
          invalid_status: runsInvalidStatus.length,
          superseded_no_ref: runsSupersededNoRef.length,
          stuck_processing: runsStuckProcessing.length,
        },
        prepared_dataset_lines: {
          total: preparedDatasetLines.length,
          no_run_id: preparedNoRun.length,
          orphan_run: preparedOrphanRun.length,
          invalid_scope: preparedInvalidScope.length,
        },
        consolidation_entries: {
          total: consolidationEntries.length,
          no_period: consEntriesNoPeriod.length,
          invalid_status: consEntriesInvalidStatus.length,
          posted_no_run: consEntriesPostedNoRun.length,
        },
        intercompany_reconciliations: {
          total: intercompanyReconciliations.length,
          unmatched: reconUnmatched.length,
          no_entity_ref: reconNoEntity.length,
        },
        scope_entities: {
          total: scopeEntities.length,
          no_entity_id: scopeNoEntityId.length,
        },
        stmt_lines_no_entity_code: stmtLinesNoEntityCode,
        indicators_no_entity_code: indicatorsNoEntityCode,
        source_issues: multiEntitySourceIssues,
      },
      invalid_mapping_source_count: invalidMappingSource.length,
      duplicate_statement_lines: duplicateLines,
      by_upload: byUpload,
      by_upload_summary: byUploadSummary,
      by_run_summary: byRunSummary,
      warnings,
      blocking_issues: blockingIssues,
      is_healthy: blockingIssues.length === 0,
      integrity_status: integrityStatus,
      integrity_checked_at: checkedAt,
    };

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});