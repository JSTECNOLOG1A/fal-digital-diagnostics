/**
 * prepareFinancialAnalysisDataset — v2.1 (multi-run por série)
 * Camada de preparação multi-entidade.
 *
 * Valida escopo, completude e duplicidade de fontes; agrega bruto por entidade;
 * aplica eliminações/ajustes/reclassificações; gera séries segregadas em runs
 * independentes (um run por série), de forma que buildFinancialStatements processe
 * cada série isoladamente sem mistura:
 *   - combined    → 1 run (dataset_scope='combined')
 *   - consolidated → 2 runs: dataset_scope='parent' (controladora pura)
 *                              + dataset_scope='consolidated' (perímetro + elim/adj/reclass)
 *
 * Equação obrigatória por linha: gross + elimination + adjustment + reclassification = final
 * Calcula checksum determinístico e valida a equação.
 *
 * Payload: { diagnosis_id }
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

function canonicalize(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('CANONICAL_NON_FINITE_NUMBER');
    return Object.is(value, -0) ? 0 : Number(value.toPrecision(15));
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const excluded = new Set(['created_date','created_at','created_by_id','published_at','superseded_at','invalidated_at']);
  return Object.fromEntries(Object.keys(value).filter((key) => !excluded.has(key)).sort().map((key) => [key, canonicalize(value[key])]));
}
async function sha256Canonical(value) {
  const data = new TextEncoder().encode(JSON.stringify(canonicalize(value)));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  let activeRunId = null;
  let activeBase44 = null;
  let activeDiagnosisId = null;
  let candidateSnapshotId = null;
  let candidatePreparationRunIds = [];
  let previousDiagnosisState = null;
  try {
    const base44 = createClientFromRequest(req);
    activeBase44 = base44;
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    const isHQ = appRole === 'hq_admin';
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const { diagnosis_id } = await req.json();
    if (!diagnosis_id) return Response.json({ error: 'diagnosis_id obrigatório' }, { status: 400 });

    const diagnosis = await base44.asServiceRole.entities.FinancialDiagnosis.get(diagnosis_id);
    if (!diagnosis) return Response.json({ error: 'Diagnóstico não encontrado' }, { status: 404 });
    activeDiagnosisId = diagnosis_id;
    previousDiagnosisState = { status: diagnosis.status, current_preparation_run_id: diagnosis.current_preparation_run_id || null, current_processing_snapshot_id: diagnosis.current_processing_snapshot_id || null };
    // ── Tenant + Role Guard (antes de qualquer mutation) ──
    const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);
    if (!WRITE_ROLES.has(appRole)) {
      return Response.json({ error: 'Forbidden: insufficient role' }, { status: 403 });
    }

    if ((appRole !== 'hq_admin') && diagnosis.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Acesso negado: tenant não autorizado' }, { status: 403 });
    }

    // ── Validar analysis_type ANTES de criar run ──
    const analysisType = diagnosis.analysis_type || 'individual';
    if (analysisType === 'individual') {
      return Response.json({ error: 'Análise individual não requer preparação' }, { status: 400 });
    }
    if (analysisType === 'consolidated' && !diagnosis.parent_entity_id) {
      return Response.json({ error: 'CONSOLIDATED_PARENT_REQUIRED' }, { status: 400 });
    }

    const tenantId = diagnosis.tenant_id;

    // 1. Validar escopo ANTES de criar run
    const scopeEntities = await base44.asServiceRole.entities.FinancialAnalysisScopeEntity.filter(
      { financial_diagnosis_id: diagnosis_id, is_active: true }, 'id', 100
    );
    if (scopeEntities.length === 0) {
      return Response.json({ error: 'Nenhuma entidade ativa no escopo. Configure o perímetro primeiro.' }, { status: 400 });
    }

    // 2. Uploads validados
    const uploads = await base44.asServiceRole.entities.FinancialUpload.filter(
      { financial_diagnosis_id: diagnosis_id }, '-created_date', 200
    );
    const validUploads = uploads.filter((u) => ['validated', 'processed'].includes(u.upload_status));

    // 3. VALIDAÇÕES de fonte
    const sourceIssues = [];
    const scopeEntityIds = new Set(scopeEntities.map((s) => s.entity_id));

    const resolvePeriod = (u) => {
      if (u.source_period) return u.source_period;
      try { return JSON.parse(u.notes || '{}').period_override || null; } catch { return null; }
    };

    for (const u of validUploads) {
      if (!u.source_entity_id) {
        sourceIssues.push({ code: 'UPLOAD_NO_SOURCE_ENTITY', upload_id: u.id, file_name: u.file_name, message: `Upload "${u.file_name}" sem source_entity_id.` });
      } else if (!scopeEntityIds.has(u.source_entity_id)) {
        sourceIssues.push({ code: 'UPLOAD_SOURCE_OUT_OF_SCOPE', upload_id: u.id, file_name: u.file_name, source_entity_id: u.source_entity_id, message: `Upload "${u.file_name}" vinculado à entidade ${u.source_entity_id} fora do escopo.` });
      }
      if (!resolvePeriod(u)) {
        sourceIssues.push({ code: 'UPLOAD_NO_PERIOD', upload_id: u.id, file_name: u.file_name, message: `Upload "${u.file_name}" sem período identificável.` });
      }
    }

    // 4. Matriz entidade × período + duplicidade
    const matrix = {};
    for (const u of validUploads) {
      if (!u.source_entity_id) continue;
      const period = resolvePeriod(u);
      if (!period) continue;
      if (!matrix[u.source_entity_id]) matrix[u.source_entity_id] = {};
      if (!matrix[u.source_entity_id][period]) matrix[u.source_entity_id][period] = [];
      matrix[u.source_entity_id][period].push(u);
    }
    for (const [eid, periods] of Object.entries(matrix)) {
      for (const [period, ups] of Object.entries(periods)) {
        if (ups.length > 1) {
          sourceIssues.push({ code: 'DUPLICATE_ENTITY_PERIOD', entity_id: eid, period, count: ups.length, message: `Entidade ${eid} período ${period} possui ${ups.length} fontes (duplicidade).` });
        }
      }
    }

    // 5. Completude
    for (const s of scopeEntities) {
      if (!matrix[s.entity_id] || Object.keys(matrix[s.entity_id]).length === 0) {
        sourceIssues.push({ code: 'ENTITY_NO_SOURCE', entity_id: s.entity_id, entity_name: s.entity_name, role: s.role, message: `Entidade ${s.entity_name || s.entity_id} (role: ${s.role}) sem fonte contábil importada.` });
      }
    }

    const blockingCodes = ['UPLOAD_NO_SOURCE_ENTITY', 'UPLOAD_SOURCE_OUT_OF_SCOPE', 'DUPLICATE_ENTITY_PERIOD', 'ENTITY_NO_SOURCE'];
    const blockingIssues = sourceIssues.filter((i) => blockingCodes.includes(i.code));
    if (blockingIssues.length > 0) {
      return Response.json({ error: 'Preparação bloqueada por inconsistências de fonte', issues: sourceIssues, blocking_count: blockingIssues.length }, { status: 400 });
    }

    // ── F2-UPL-01: Criar run APÓS validar payload, role/tenant, analysis_type e escopo ──
    // No catch+warn+continue — run creation failure ABORTS the operation.
    const [fingerprintEntries, registryResponse] = await Promise.all([
      base44.asServiceRole.entities.FinancialConsolidationEntry.filter({ financial_diagnosis_id: diagnosis_id, status: 'posted' }, 'entry_number', 500),
      base44.functions.invoke('getFinancialCanonicalRegistry', {}),
    ]);
    const registryAudit = registryResponse?.data || registryResponse;
    if (!registryAudit?.valid || !registryAudit.hash) return Response.json({ error: 'FINANCIAL_REGISTRY_UNAVAILABLE' }, { status: 503 });
    const sourceResponse = await base44.functions.invoke('resolveCurrentFinancialSourcesForPerimeter', { diagnosis_id });
    const sourceResolution = sourceResponse?.data || sourceResponse;
    if (!Array.isArray(sourceResolution?.sources)) return Response.json({ error: sourceResolution?.error || 'CURRENT_FINANCIAL_SOURCE_REQUIRED' }, { status: 409 });
    const sourceByKey = new Map(sourceResolution.sources.map((source) => [`${source.source_entity_id}|${source.source_period}`, source]));
    const sourceOutputs = [];
    const sourceLinePages = [];
    for (const item of validUploads) {
      const period = resolvePeriod(item);
      const source = sourceByKey.get(`${item.source_entity_id}|${period}`);
      if (!source) return Response.json({ error: 'CURRENT_FINANCIAL_SOURCE_REQUIRED', upload_id: item.id }, { status: 409 });
      sourceOutputs.push({ source_entity_id: source.source_entity_id, source_period: source.source_period, source_key: source.source_key, financial_upload_id: source.financial_upload_id, source_processing_run_id: source.processing_run_id, source_snapshot_id: source.snapshot_id, source_input_checksum: source.input_checksum, source_output_checksum: source.output_checksum, mapping_checksum: source.mapping_checksum, registry_hash: source.registry_hash || registryAudit.hash, formula_version: source.formula_version });
      sourceLinePages.push(base44.asServiceRole.entities.FinancialStatementLine.filter({ financial_diagnosis_id: diagnosis_id, financial_upload_id: source.financial_upload_id, processing_run_id: source.processing_run_id, publication_status: 'active', period: source.source_period, dataset_scope: 'individual' }, 'period', 50000));
    }
    const allSourceLines = (await Promise.all(sourceLinePages)).flat();
    if (!allSourceLines.length) return Response.json({ error:'SOURCE_ACTIVE_OUTPUTS_REQUIRED' }, { status:409 });
    if (sourceOutputs.some((item)=>!item.source_entity_id || !item.source_period || !item.source_key || !item.source_input_checksum || !item.source_processing_run_id || !item.source_snapshot_id || !item.source_output_checksum)) return Response.json({ error:'SOURCE_OUTPUT_FINGERPRINT_INCOMPLETE' }, { status:409 });
    sourceOutputs.sort((a, b) => `${a.source_entity_id}|${a.source_period}`.localeCompare(`${b.source_entity_id}|${b.source_period}`));
    const prepareInput = {
      operation: 'prepare', diagnosis_id, analysis_type: analysisType,
      parent_entity_id: diagnosis.parent_entity_id || null, presenting_entity_id: diagnosis.presenting_entity_id || null,
      perimeter: scopeEntities.map((item) => ({ id:item.id, entity_id:item.entity_id, entity_type:item.entity_type, role:item.role, control_type:item.control_type, consolidation_method:item.consolidation_method, direct_ownership_pct:item.direct_ownership_pct, indirect_ownership_pct:item.indirect_ownership_pct, voting_rights_pct:item.voting_rights_pct })),
      uploads: validUploads.map((item) => ({ id:item.id, source_entity_id:item.source_entity_id, source_period:resolvePeriod(item), input_checksum:item.input_checksum || null, is_current:item.is_current, upload_status:item.upload_status })),
      source_outputs: sourceOutputs,
      posted_entries: fingerprintEntries.map((item) => ({ id:item.id, period:item.period, entry_nature:item.entry_nature, entry_type:item.entry_type, origin_entity_id:item.origin_entity_id, destination_entity_id:item.destination_entity_id, source_entity_id:item.source_entity_id, counterparty_entity_id:item.counterparty_entity_id, debit_canonical_key:item.debit_canonical_key, credit_canonical_key:item.credit_canonical_key, amount:item.amount, status:item.status, version:item.updated_date || null })),
      registry_version: registryAudit.version, registry_hash: registryAudit.hash, formula_version: 'FAL-FIN-3.0.0', configuration_version: 'R3',
    };
    const prepareInputFingerprint = await sha256Canonical(prepareInput);
    const operationKey = `prepare|${diagnosis.tenant_id}|${diagnosis_id}|sha256:${prepareInputFingerprint}`;
    const existingRuns = await base44.asServiceRole.entities.FinancialProcessingRun.filter(
      { operation_key: operationKey, status: { $in: ['running', 'committing', 'succeeded'] } }, 'id', 10
    );
    if (existingRuns.length > 0) {
      const existing = existingRuns[0];
      if (existing.status === 'succeeded') {
        const snapshotId = existing.result_summary?.snapshot_id;
        const snapshot = snapshotId ? await base44.asServiceRole.entities.FinancialProcessingSnapshot.get(snapshotId) : null;
        const activeOutputs = await base44.asServiceRole.entities.PreparedFinancialDatasetLine.filter({ financial_diagnosis_id:diagnosis_id, processing_run_id:existing.id, publication_status:'active' }, 'id', 50000);
        const expectedCount = Number(snapshot?.integrity_summary?.prepared_lines || 0);
        if (!snapshot || snapshot.financial_processing_run_id !== existing.id || snapshot.status !== 'active' || diagnosis.current_processing_snapshot_id !== snapshot.id || activeOutputs.length !== expectedCount) return Response.json({ error: 'REUSED_RUN_INTEGRITY_FAILED', run_id: existing.id }, { status: 409 });
        return Response.json({ success: true, reused: true, run_id: existing.id, operation_key:operationKey, input_checksum:prepareInputFingerprint, snapshot_id: snapshot.id, output_checksum:snapshot.output_checksum, status: 'succeeded' });
      }
      return Response.json({ success: false, in_progress: true, reused: true, run_id: existing.id, status: existing.status }, { status: 202 });
    }
    const now = new Date().toISOString();
    const processingRun = await base44.asServiceRole.entities.FinancialProcessingRun.create({
      tenant_id: diagnosis.tenant_id,
      financial_diagnosis_id: diagnosis_id,
      operation_type: analysisType === 'combined' ? 'combine_entities' : 'consolidate_entities',
      operation_key: operationKey,
      input_checksum: prepareInputFingerprint,
      registry_version: registryAudit.version,
      formula_version: 'FAL-FIN-3.0.0',
      status: 'running',
      started_at: now,
      triggered_by: user.email,
    });
    const runId = processingRun.id;
    activeRunId = runId;
    // Helper: complete/fail run — every return path after this point must call one.
    const completeRun = async (resultSummary, outputChecksum) => {
      try {
        await base44.asServiceRole.entities.FinancialProcessingRun.update(runId, {
          status: 'committing',
          result_summary: { ...resultSummary, success: false, snapshot_pending: true }, output_checksum: outputChecksum || null,
        });
      } catch (e) { console.error('[prepareDataset] erro ao completar run:', e.message); }
    };
    const failRun = async (errorMsg, status = 'failed') => {
      try {
        await base44.asServiceRole.entities.FinancialProcessingRun.update(runId, {
          status, completed_at: new Date().toISOString(),
          error_details: { error: errorMsg },
          result_summary: { success: false, error: errorMsg },
        });
      } catch (e) { console.error('[prepareDataset] erro ao falhar run:', e.message); }
    };

    // Estado anterior permanece publicado até o commit do candidato.
    const oldRuns = await base44.asServiceRole.entities.FinancialPreparationRun.filter(
      { financial_diagnosis_id: diagnosis_id, status: { $in: ['draft', 'processing', 'prepared'] } }, 'id', 50
    );
    const oldRunIds = oldRuns.map((r) => r.id);

    // 7. As linhas individuais foram resolvidas pelo snapshot/run atual antes da operation key.
    const linesByEntity = {};
    let sourceLineCount = 0;
    for (const sl of allSourceLines) {
      if (!sl.period || sl.period === 'SEM_DATA') continue;
      if (!sl.canonical_key) continue;
      if (sl.canonical_key.startsWith('total_') || sl.canonical_key.startsWith('dfc_')) continue;
      if (sl.line_type === 'calculated' || sl.line_type === 'total' || sl.line_type === 'subtotal') continue;
      const ec = sl.entity_code || 'UNKNOWN';
      if (!linesByEntity[ec]) linesByEntity[ec] = {};
      if (!linesByEntity[ec][sl.period]) linesByEntity[ec][sl.period] = {};
      if (!linesByEntity[ec][sl.period][sl.canonical_key]) {
        linesByEntity[ec][sl.period][sl.canonical_key] = {
          value: 0, rubric_label: sl.rubric_label, group_label: sl.group_label,
          statement_code: sl.statement_code, display_order: sl.display_order,
          column_key: sl.column_key, column_label: sl.column_label, period_type: sl.period_type,
        };
      }
      linesByEntity[ec][sl.period][sl.canonical_key].value += Number(sl.value) || 0;
      sourceLineCount++;
    }

    // 8. Cédulas aprovadas/posted
    const entries = await base44.asServiceRole.entities.FinancialConsolidationEntry.filter(
      { financial_diagnosis_id: diagnosis_id, status: 'posted' }, 'entry_number', 500
    );
    for (const entry of entries) {
      const validationResponse = await base44.functions.invoke('executeFinancialEngine', {
        action: 'validate_entry',
        entry: { ...entry, origin_entity_id: entry.source_entity_id, destination_entity_id: entry.counterparty_entity_id, justification: entry.justification || entry.rationale },
      });
      const validation = validationResponse?.data || validationResponse;
      if (!validation?.valid) {
        await failRun(validation?.errors?.[0]?.code || 'ELIMINATION_SOURCE_RUBRIC_REQUIRED');
        return Response.json({ error: validation?.errors?.[0]?.code || 'ELIMINATION_SOURCE_RUBRIC_REQUIRED', errors: validation?.errors || [] }, { status: 422 });
      }
      entry._debit_presentation_effect = validation.journal_effects?.debit;
      entry._credit_presentation_effect = validation.journal_effects?.credit;
    }
    const eliminationEntries = entries.filter((e) => e.entry_nature === 'elimination');
    const adjustmentEntries = entries.filter((e) => e.entry_nature === 'consolidation_adjustment');
    const reclassificationEntries = entries.filter((e) => e.entry_nature === 'reclassification');

    // 9. Agregar bruto de um conjunto de entidades
    const aggregateGross = (entityCodes) => {
      const gross = {};
      for (const ec of entityCodes) {
        const ent = linesByEntity[ec];
        if (!ent) continue;
        for (const [period, keys] of Object.entries(ent)) {
          if (!gross[period]) gross[period] = {};
          for (const [ck, data] of Object.entries(keys)) {
            if (!gross[period][ck]) gross[period][ck] = { value: 0, ...data };
            gross[period][ck].value += data.value;
          }
        }
      }
      return gross;
    };

    // 10. Construir prepared lines para uma série
    const buildSeriesLines = (gross, dsScope, repEntityId, runId, applyElim, applyAdj, applyReclass, totals) => {
      const lines = [];
      for (const [period, keys] of Object.entries(gross)) {
        for (const [ck, data] of Object.entries(keys)) {
          const grossValue = data.value;
          let eliminationValue = 0, adjustmentValue = 0, reclassificationValue = 0;
          if (applyElim) {
            for (const e of eliminationEntries) {
              if (e.period !== period) continue;
              if (e.debit_canonical_key === ck) eliminationValue += Number(e._debit_presentation_effect) || 0;
              if (e.credit_canonical_key === ck) eliminationValue += Number(e._credit_presentation_effect) || 0;
            }
          }
          if (applyAdj) {
            for (const e of adjustmentEntries) {
              if (e.period !== period) continue;
              if (e.debit_canonical_key === ck) adjustmentValue += Number(e._debit_presentation_effect) || 0;
              if (e.credit_canonical_key === ck) adjustmentValue += Number(e._credit_presentation_effect) || 0;
            }
          }
          if (applyReclass) {
            for (const e of reclassificationEntries) {
              if (e.period !== period) continue;
              if (e.debit_canonical_key === ck) reclassificationValue += Number(e._debit_presentation_effect) || 0;
              if (e.credit_canonical_key === ck) reclassificationValue += Number(e._credit_presentation_effect) || 0;
            }
          }
          const finalValue = grossValue + eliminationValue + adjustmentValue + reclassificationValue;
          totals.gross += grossValue; totals.elim += eliminationValue;
          totals.adj += adjustmentValue; totals.reclass += reclassificationValue; totals.final += finalValue;
          lines.push({
            tenant_id: tenantId, financial_diagnosis_id: diagnosis_id, preparation_run_id: runId,
            processing_run_id: activeRunId, publication_status: 'candidate',
            dataset_scope: dsScope, reporting_entity_id: repEntityId,
            source_entity_id: null, source_entity_name: null, period,
            column_key: data.column_key || period, column_label: data.column_label || null,
            period_type: data.period_type || 'monthly',
            account_code: null, account_description: null,
            canonical_key: ck, rubric_label: data.rubric_label, group_label: data.group_label,
            statement_code: data.statement_code || 'NAO_CLASSIFICADO', display_order: data.display_order || 0,
            sign_rule: 'normal', note_reference: null,
            gross_value: grossValue, elimination_value: eliminationValue,
            adjustment_value: adjustmentValue, reclassification_value: reclassificationValue,
            final_value: finalValue, line_origin: 'source_aggregation', consolidation_entry_id: null,
          });
        }
      }
      return lines;
    };

    // 11. Definir specs de séries
    const parentEntityId = diagnosis.parent_entity_id;
    const subsidiaryIds = scopeEntities.filter((s) => s.role === 'subsidiary').map((s) => s.entity_id);
    const presentingId = diagnosis.presenting_entity_id;

    const seriesSpecs = [];
    if (analysisType === 'combined') {
      const allEntityCodes = scopeEntities.map((s) => s.entity_id).filter((ec) => linesByEntity[ec]);
      // Combinada = soma do perímetro em coluna única, com eliminações/ajustes aprovados aplicados na própria série.
      seriesSpecs.push({ dsScope: 'combined', repEntity: presentingId || 'COMBINED', entityCodes: allEntityCodes, applyElim: true, applyAdj: true, applyReclass: true });
    } else if (analysisType === 'consolidated') {
      const allEntityCodes = [parentEntityId, ...subsidiaryIds].filter((ec) => linesByEntity[ec]);
      // Série PARENT: controladora pura, sem eliminações/ajustes do consolidado
      seriesSpecs.push({ dsScope: 'parent', repEntity: parentEntityId, entityCodes: [parentEntityId].filter((ec) => linesByEntity[ec]), applyElim: false, applyAdj: false, applyReclass: false });
      // Série CONSOLIDATED: perímetro + eliminações + ajustes + reclassificações
      seriesSpecs.push({ dsScope: 'consolidated', repEntity: parentEntityId, entityCodes: allEntityCodes, applyElim: true, applyAdj: true, applyReclass: true });
    }

    // Outputs candidatos são segregados pelo novo preparation_run_id; nenhum estado válido é apagado antes do commit.

    // 13. Criar runs + prepared lines por série
    const runNumberBase = (oldRuns.length || 0);
    const createdRuns = [];
    const allPreparedLines = [];
    const totals = { gross: 0, elim: 0, adj: 0, reclass: 0, final: 0 };
    const equationViolations = [];

    for (let i = 0; i < seriesSpecs.length; i++) {
      const spec = seriesSpecs[i];
      const run = await base44.asServiceRole.entities.FinancialPreparationRun.create({
        tenant_id: tenantId, financial_diagnosis_id: diagnosis_id, processing_run_id: activeRunId, checksum:`pending:${activeRunId}`, run_number: runNumberBase + i + 1,
        analysis_type: analysisType, dataset_scope: spec.dsScope, reporting_entity_id: spec.repEntity,
        status: 'processing', started_at: new Date().toISOString(), source_count: scopeEntities.length, created_by: user.email,
      });
      const gross = aggregateGross(spec.entityCodes);
      const lines = buildSeriesLines(gross, spec.dsScope, spec.repEntity, run.id, spec.applyElim, spec.applyAdj, spec.applyReclass, totals);
      // Validação da equação
      for (const l of lines) {
        const calc = l.gross_value + l.elimination_value + l.adjustment_value + l.reclassification_value;
        if (Math.abs(calc - l.final_value) > 0.01) {
          equationViolations.push({ canonical_key: l.canonical_key, period: l.period, dataset_scope: l.dataset_scope, calc, final: l.final_value });
        }
      }
      allPreparedLines.push(...lines);
      createdRuns.push({ run_id: run.id, dataset_scope: spec.dsScope, reporting_entity_id: spec.repEntity, line_count: lines.length });
      candidatePreparationRunIds.push(run.id);

      // Atualizar run com totais da série
      const sGross = lines.reduce((s, l) => s + l.gross_value, 0);
      const sElim = lines.reduce((s, l) => s + l.elimination_value, 0);
      const sAdj = lines.reduce((s, l) => s + l.adjustment_value, 0);
      const sReclass = lines.reduce((s, l) => s + l.reclassification_value, 0);
      const sFinal = lines.reduce((s, l) => s + l.final_value, 0);
      const seriesChecksum = await sha256Canonical({ dataset_scope:spec.dsScope, reporting_entity_id:spec.repEntity, periods:[...new Set(lines.map((line)=>line.period))].sort(), registry_hash:registryAudit.hash, lines:lines.map((line)=>({ period:line.period, canonical_key:line.canonical_key, final_value:line.final_value, elimination_value:line.elimination_value })) });
      await base44.asServiceRole.entities.FinancialPreparationRun.update(run.id, {
        status: 'processing', processing_run_id:activeRunId, checksum:seriesChecksum,
        source_line_count: sourceLineCount, prepared_line_count: lines.length,
        elimination_entry_count: spec.applyElim ? eliminationEntries.length : 0,
        adjustment_entry_count: spec.applyAdj ? adjustmentEntries.length : 0,
        gross_total: sGross, elimination_total: sElim, adjustment_total: sAdj, final_total: sFinal,
      });
    }

    // 14. Homologação pós-eliminação: dupla partida, residual intercompany, BP e fórmulas DRE.
    const finalValidationErrors = [...equationViolations.map((item) => ({ code: 'PREPARED_LINE_EQUATION_MISMATCH', ...item }))];
    for (const entry of entries) {
      const debitEffect = Number(entry._debit_presentation_effect);
      const creditEffect = Number(entry._credit_presentation_effect);
      if (!Number.isFinite(debitEffect) || !Number.isFinite(creditEffect)) finalValidationErrors.push({ code: 'ELIMINATION_JOURNAL_EFFECT_UNDEFINED', entry_id: entry.id });
      const originValue = linesByEntity[entry.source_entity_id]?.[entry.period]?.[entry.debit_canonical_key]?.value ?? null;
      const destinationValue = linesByEntity[entry.counterparty_entity_id]?.[entry.period]?.[entry.credit_canonical_key]?.value ?? null;
      const matched = originValue == null || destinationValue == null ? null : Math.min(Math.abs(originValue), Math.abs(destinationValue));
      const difference = matched == null ? null : Math.abs(Math.abs(originValue) - Math.abs(destinationValue));
      const residual = matched == null ? null : matched - Math.abs(Number(entry.amount));
      const reconciliationStatus = residual == null || Math.abs(residual) > 0.01 ? 'blocking' : 'matched';
      await base44.asServiceRole.entities.FinancialConsolidationEntry.update(entry.id, {
        origin_value: originValue, destination_value: destinationValue, difference_value: difference,
        eliminated_value: Number(entry.amount), residual_difference: residual, reconciliation_status: reconciliationStatus,
      });
      if (reconciliationStatus === 'blocking') finalValidationErrors.push({ code: 'INTERCOMPANY_RESIDUAL_ABOVE_MATERIALITY', entry_id: entry.id, residual });
    }
    for (const created of createdRuns) {
      const runLines = allPreparedLines.filter((line) => line.preparation_run_id === created.run_id);
      const periods = [...new Set(runLines.map((line) => line.period))];
      for (const period of periods) {
        const sourceValues = {};
        for (const line of runLines.filter((item) => item.period === period)) sourceValues[line.canonical_key] = line.final_value;
        const engineResponse = await base44.functions.invoke('executeFinancialEngine', {
          action: 'compute', source_values: sourceValues,
          context: { period, dataset_scope: created.dataset_scope, reporting_entity_id: created.reporting_entity_id },
        });
        const engine = engineResponse?.data || engineResponse;
        if (engine?.bp?.balanced !== true) finalValidationErrors.push({ code: engine?.bp?.validation?.code || 'BP_ACCOUNTING_EQUATION_MISMATCH', period, dataset_scope: created.dataset_scope, expected: engine?.bp?.expected, actual: engine?.bp?.actual, difference: engine?.bp?.difference });
        if (!engine?.statements || engine.formula_version !== 'FAL-FIN-3.0.0') finalValidationErrors.push({ code: 'DRE_FORMULA_DIVERGENCE', period, dataset_scope: created.dataset_scope });
      }
    }
    if (finalValidationErrors.length > 0) {
      for (const created of createdRuns) await base44.asServiceRole.entities.FinancialPreparationRun.update(created.run_id, { status: 'validation_failed', completed_at: new Date().toISOString() });
      await failRun('POST_ELIMINATION_VALIDATION_FAILED');
      return Response.json({ error: 'POST_ELIMINATION_VALIDATION_FAILED', validations: finalValidationErrors }, { status: 422 });
    }

    // 15. Persistir prepared lines
    const bi = async (e, items) => {
      if (!items.length) return;
      for (let i = 0; i < items.length; i += 250) await e.bulkCreate(items.slice(i, i + 250));
    };
    await bi(base44.asServiceRole.entities.PreparedFinancialDatasetLine, allPreparedLines);
    for (const created of createdRuns) await base44.asServiceRole.entities.FinancialPreparationRun.update(created.run_id, { status: 'prepared', completed_at: new Date().toISOString() });

    // 16. Checksum
    const checksum = await sha256Canonical({
      inputs: prepareInput,
      outputs: allPreparedLines.map((line) => ({ canonical_key:line.canonical_key, period:line.period, dataset_scope:line.dataset_scope, reporting_entity_id:line.reporting_entity_id, gross_value:line.gross_value, elimination_value:line.elimination_value, adjustment_value:line.adjustment_value, reclassification_value:line.reclassification_value, final_value:line.final_value })),
    });

    const lastRunId = createdRuns[createdRuns.length - 1]?.run_id;
    console.log(`[prepareDataset v2.1] ${analysisType}: ${createdRuns.length} run(s), ${allPreparedLines.length} linhas | gross=${totals.gross} elim=${totals.elim} adj=${totals.adj} reclass=${totals.reclass} final=${totals.final} | eqViolations=${equationViolations.length}`);

    await completeRun({ success: true, snapshot_pending: true, preparation_run_ids: createdRuns.map((r) => r.run_id), prepared_line_count: allPreparedLines.length, checksum, dataset_scopes: createdRuns.map((r) => r.dataset_scope), source_outputs: sourceOutputs }, checksum);
    const snapshotResponse = await base44.functions.invoke('createFinancialProcessingSnapshot', { financial_diagnosis_id: diagnosis_id, processing_run_id: runId, previous_snapshot_id: previousDiagnosisState.current_processing_snapshot_id, commit_scope: 'diagnosis', publish_pointer: false });
    const snapshot = snapshotResponse?.data || snapshotResponse;
    if (!snapshot?.snapshot_id) throw new Error('Preparação sem snapshot obrigatório');
    candidateSnapshotId = snapshot.snapshot_id;
    const persistedSnapshot = await base44.asServiceRole.entities.FinancialProcessingSnapshot.get(snapshot.snapshot_id);
    if (!persistedSnapshot || persistedSnapshot.financial_processing_run_id !== runId || persistedSnapshot.status !== 'candidate' || !persistedSnapshot.output_checksum) throw new Error('SNAPSHOT_POSTCONDITION_FAILED');
    const publishedAt = new Date().toISOString();
    await base44.asServiceRole.entities.PreparedFinancialDatasetLine.updateMany({ processing_run_id: runId, publication_status: 'candidate' }, { $set: { publication_status: 'active', published_at: publishedAt } });
    await base44.asServiceRole.entities.FinancialProcessingSnapshot.update(snapshot.snapshot_id, { status: 'active' });
    await base44.asServiceRole.entities.FinancialDiagnosis.update(diagnosis_id, { status: 'prepared', current_preparation_run_id: lastRunId || null, current_processing_snapshot_id: snapshot.snapshot_id });
    const committedDiagnosis = await base44.asServiceRole.entities.FinancialDiagnosis.get(diagnosis_id);
    if (committedDiagnosis.current_processing_snapshot_id !== snapshot.snapshot_id) throw new Error('POINTER_POSTCONDITION_FAILED');
    await base44.asServiceRole.entities.FinancialProcessingRun.update(runId, { status: 'succeeded', cleanup_pending:false, completed_at: new Date().toISOString(), output_checksum: snapshot.output_checksum, result_summary: { success: true, snapshot_pending: false, snapshot_id: snapshot.snapshot_id, preparation_run_ids: createdRuns.map((item) => item.run_id), prepared_line_count: allPreparedLines.length, checksum, source_outputs:sourceOutputs, dataset_scopes: createdRuns.map((item) => item.dataset_scope) } });
    try {
      for (const oldId of oldRunIds) await base44.asServiceRole.entities.FinancialPreparationRun.update(oldId, { status: 'superseded', superseded_by_run_id: lastRunId });
      const previousSnapshot = previousDiagnosisState.current_processing_snapshot_id ? await base44.asServiceRole.entities.FinancialProcessingSnapshot.get(previousDiagnosisState.current_processing_snapshot_id) : null;
      if (previousSnapshot?.financial_processing_run_id) await base44.asServiceRole.entities.PreparedFinancialDatasetLine.updateMany({ financial_diagnosis_id:diagnosis_id, processing_run_id:previousSnapshot.financial_processing_run_id, publication_status:'active' }, { $set: { publication_status:'superseded', superseded_at:publishedAt } });
      // Snapshots históricos permanecem active e replayable; apenas o ponteiro define o conjunto atual.
    } catch (cleanupError) { await base44.asServiceRole.entities.FinancialProcessingRun.update(runId,{ status:'succeeded', cleanup_pending:true, error_details:{ cleanup_error:cleanupError.message } }); }
    for (const e of entries.filter((x) => x.status === 'posted' && !x.preparation_run_id)) await base44.asServiceRole.entities.FinancialConsolidationEntry.update(e.id, { preparation_run_id: lastRunId });

    return Response.json({
      success: true,
      run_id: runId,
      operation_key: operationKey,
      input_checksum: prepareInputFingerprint,
      snapshot_id: snapshot.snapshot_id,
      output_checksum: snapshot.output_checksum,
      analysis_type: analysisType,
      runs: createdRuns,
      series: createdRuns.map((r) => r.dataset_scope),
      prepared_line_count: allPreparedLines.length,
      source_line_count: sourceLineCount,
      gross_total: totals.gross,
      elimination_total: totals.elim,
      adjustment_total: totals.adj,
      reclassification_total: totals.reclass,
      final_total: totals.final,
      checksum,
      equation_violations: equationViolations.length,
      source_issues: sourceIssues,
      blocking_count: blockingIssues.length,
    });
  } catch (error) {
    console.error('[prepareDataset v2.1] ERROR:', error.message, error.stack);
    if (activeRunId && activeBase44) {
      try {
        if (candidateSnapshotId) await activeBase44.asServiceRole.entities.FinancialProcessingSnapshot.update(candidateSnapshotId, { status: 'invalid', invalid_reason: error.message, invalidated_at: new Date().toISOString(), invalidated_by_run_id: activeRunId });
        if (activeDiagnosisId && previousDiagnosisState) await activeBase44.asServiceRole.entities.FinancialDiagnosis.update(activeDiagnosisId, previousDiagnosisState);
        for (const preparationRunId of candidatePreparationRunIds) {
          await activeBase44.asServiceRole.entities.FinancialPreparationRun.update(preparationRunId, { status: 'validation_failed', completed_at: new Date().toISOString() });
          await activeBase44.asServiceRole.entities.PreparedFinancialDatasetLine.updateMany({ preparation_run_id: preparationRunId, processing_run_id:activeRunId, publication_status: { $in:['candidate','active'] } }, { $set: { publication_status: 'invalid', invalidated_at: new Date().toISOString(), invalidation_reason: error.message } });
        }
        await activeBase44.asServiceRole.entities.FinancialProcessingRun.update(activeRunId, { status: candidateSnapshotId ? 'partial_failed' : 'failed', completed_at: new Date().toISOString(), error_details: { error: error.message }, result_summary: { success: false, error: error.message } });
      } catch {}
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
});