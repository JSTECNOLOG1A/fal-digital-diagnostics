/**
 * createFinancialProcessingSnapshot — F2-SNP-01 (RESIDUAL 3).
 *
 * v4 (RESIDUAL 3):
 *   - 5.1: Run-scoped — carrega somente outputs pertencentes ao run, NÃO todos
 *     os outputs do diagnóstico. Para operações por upload: filtra por
 *     financial_upload_id do run. Para preparação: filtra por preparation_run_id.
 *   - 5.2: Manifesto completo — registros canônicos ordenados com key/period/
 *     entity_code/canonical_key/value, não apenas contagens.
 *   - 5.3: SHA-256 determinístico — substitui o hash simples de 32 bits.
 *     Serialização canônica: arrays ordenados, chaves ordenadas, números
 *     normalizados, timestamps excluídos.
 *   - 1.1: Append-only — nunca atualiza snapshot anterior.
 *   - 2.1: Write-role guard — hq_admin, tenant_admin, consultant. client_viewer=403.
 *   - 2.2: Um snapshot por run — retry reutiliza.
 *   - 2.4: Publica o ponteiro atual do diagnóstico somente após criação e releitura.
 *
 * Payload: { financial_diagnosis_id, processing_run_id }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const VALID_APP_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant', 'client_viewer']);
function resolveAppRole(user) {
  if (!user) return null;
  if (VALID_APP_ROLES.has(user?.app_role)) return user.app_role;
  if (user?.role === 'admin') return 'hq_admin';
  return null;
}

const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);

// ── 5.3: Canonical serialization for deterministic SHA-256 ──
function canonicalize(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Math.round(value * 100) / 100;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    const sorted = [...value].sort((a, b) => {
      const ka = (a && typeof a === 'object' && a.key) ? a.key : JSON.stringify(canonicalize(a));
      const kb = (b && typeof b === 'object' && b.key) ? b.key : JSON.stringify(canonicalize(b));
      return String(ka) < String(kb) ? -1 : String(ka) > String(kb) ? 1 : 0;
    });
    return sorted.map(canonicalize);
  }
  const excluded = new Set(['created_date', 'updated_date', 'created_by_id', 'id', 'created_at', 'updated_at']);
  const result = {};
  for (const key of Object.keys(value).sort()) {
    if (excluded.has(key)) continue;
    result[key] = canonicalize(value[key]);
  }
  return result;
}

async function sha256Checksum(value) {
  const canonical = JSON.stringify(canonicalize(value));
  const data = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const appRole = resolveAppRole(user);
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    if (!WRITE_ROLES.has(appRole)) {
      return Response.json({ error: 'Forbidden: write permission required' }, { status: 403 });
    }

    const { financial_diagnosis_id, processing_run_id, previous_snapshot_id = null, commit_scope = 'diagnosis', publish_pointer = true } = await req.json();
    if (!financial_diagnosis_id || !processing_run_id) {
      return Response.json({ error: 'financial_diagnosis_id e processing_run_id são obrigatórios' }, { status: 400 });
    }

    const diagnosis = await base44.asServiceRole.entities.FinancialDiagnosis.get(financial_diagnosis_id);
    if (!diagnosis) return Response.json({ error: 'Diagnóstico não encontrado' }, { status: 404 });
    if (appRole !== 'hq_admin' && diagnosis.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden: diagnóstico não pertence ao seu tenant' }, { status: 403 });
    }

    // Carregar run pronto para snapshot. "committing" evita sucesso observável antes do commit final.
    const run = await base44.asServiceRole.entities.FinancialProcessingRun.get(processing_run_id);
    if (!run) return Response.json({ error: 'Processing run não encontrado' }, { status: 404 });
    if (run.financial_diagnosis_id !== financial_diagnosis_id) {
      return Response.json({ error: 'Run não pertence a este diagnóstico' }, { status: 400 });
    }
    if (!['committing', 'succeeded'].includes(run.status)) {
      return Response.json({ error: `Run não está pronto para snapshot (status: ${run.status})` }, { status: 400 });
    }

    // Um run em commit só pode possuir snapshot candidato; um run fechado só pode reutilizar snapshot ativo.
    const existingForRun = await base44.asServiceRole.entities.FinancialProcessingSnapshot.filter(
      { financial_processing_run_id: processing_run_id }, '-version_number', 10
    );
    const existingSnapshot = existingForRun.length ? existingForRun[0] : null;
    if (existingSnapshot && (existingForRun.length !== 1 || existingSnapshot.financial_processing_run_id !== processing_run_id || existingSnapshot.financial_diagnosis_id !== financial_diagnosis_id || !run.result_summary?.expected_output_counts || !existingSnapshot.source_manifest || !existingSnapshot.output_manifest)) {
      return Response.json({ error: 'REUSED_SNAPSHOT_INTEGRITY_FAILED' }, { status: 409 });
    }

    // ── 5.1: Determinar o escopo do run a partir de result_summary ──
    const resultSummary = run.result_summary || {};
    const uploadIds = resultSummary.upload_ids || [];
    const sourceHeads = resultSummary.source_heads || [];
    const sourceOutputs = resultSummary.source_outputs || [];
    const preparationRunIds = resultSummary.preparation_run_ids || (resultSummary.preparation_run_id ? [resultSummary.preparation_run_id] : []);
    if (!uploadIds.length && !sourceHeads.length && !sourceOutputs.length && ['build_statements','build_dfc','combine_entities','consolidate_entities'].includes(run.operation_type)) return Response.json({ error: 'SNAPSHOT_SOURCE_MANIFEST_REQUIRED' }, { status: 409 });

    // 3. Carregar uploads ativos pertinentes ao run
    let uploads = [];
    if (uploadIds.length > 0) {
      uploads = await base44.asServiceRole.entities.FinancialUpload.filter(
        { financial_diagnosis_id, id: { $in: uploadIds } }, '-created_date', 200
      );
    }
    if (uploads.length === 0 && sourceOutputs.length) {
      const sourceUploadIds = [...new Set(sourceOutputs.map((item) => item.financial_upload_id).filter(Boolean))];
      if (sourceUploadIds.length) uploads = await base44.asServiceRole.entities.FinancialUpload.filter({ financial_diagnosis_id, id: { $in: sourceUploadIds } }, '-created_date', 50000);
    }

    // ── R3-04: carregar exclusivamente outputs do próprio run ──
    const outputStatus = run.status === 'succeeded' ? 'active' : 'candidate';
    let stmtLines = [], indicators = [], preparedLines = [], validations = [], mappings = [], trialLines = [], dfcComposition = [];
    [stmtLines, indicators, preparedLines, validations, mappings, trialLines, dfcComposition] = await Promise.all([
      base44.asServiceRole.entities.FinancialStatementLine.filter({ financial_diagnosis_id, processing_run_id, publication_status:outputStatus }, 'id', 50000),
      base44.asServiceRole.entities.FinancialIndicatorSnapshot.filter({ financial_diagnosis_id, processing_run_id, publication_status:outputStatus }, 'id', 50000),
      base44.asServiceRole.entities.PreparedFinancialDatasetLine.filter({ financial_diagnosis_id, processing_run_id, publication_status:outputStatus }, 'id', 50000),
      base44.asServiceRole.entities.FinancialValidationResult.filter({ financial_diagnosis_id, processing_run_id, publication_status:outputStatus }, 'id', 50000),
      base44.asServiceRole.entities.FinancialMappingResolution.filter({ financial_diagnosis_id, processing_run_id, publication_status:outputStatus }, 'id', 50000),
      base44.asServiceRole.entities.FinancialTrialBalanceLine.filter({ financial_diagnosis_id, processing_run_id, publication_status:outputStatus }, 'id', 50000),
      base44.asServiceRole.entities.FinancialDfcCompositionLine.filter({ financial_diagnosis_id, processing_run_id, publication_status:outputStatus }, 'id', 50000),
    ]);
    const runScopedCount = stmtLines.length + indicators.length + preparedLines.length + validations.length + mappings.length + trialLines.length + dfcComposition.length;
    const outputProducingOperations = ['build_statements','build_dfc','combine_entities','consolidate_entities'];
    if (runScopedCount === 0 && outputProducingOperations.includes(run.operation_type)) return Response.json({ error:'SNAPSHOT_RUN_OUTPUTS_REQUIRED' }, { status:409 });

    const allOutputs = [...stmtLines,...indicators,...preparedLines,...validations,...mappings,...trialLines,...dfcComposition];
    if (allOutputs.some((item) => item.processing_run_id !== processing_run_id || item.publication_status !== outputStatus)) return Response.json({ error:'SNAPSHOT_RUN_SCOPE_VIOLATION' }, { status:409 });
    const expected = resultSummary.expected_output_counts;
    if (outputProducingOperations.includes(run.operation_type) && !expected) return Response.json({ error: 'SNAPSHOT_EXPECTED_COUNTS_REQUIRED' }, { status: 409 });
    if (expected) {
      const actual = { statement_lines: stmtLines.length, indicator_snapshots: indicators.length, validation_results: validations.length, mapping_resolutions: mappings.length, trial_balance_lines: trialLines.length, dfc_composition_lines: dfcComposition.length };
      if (Object.entries(expected).some(([key, value]) => Number(value) !== Number(actual[key] || 0))) return Response.json({ error: 'SNAPSHOT_OUTPUT_COUNT_MISMATCH', expected, actual }, { status: 409 });
    }

    const [perimeter, eliminations, registryResponse] = await Promise.all([
      base44.asServiceRole.entities.FinancialAnalysisScopeEntity.filter({ financial_diagnosis_id, is_active: true }, 'id', 500),
      base44.asServiceRole.entities.FinancialConsolidationEntry.filter({ financial_diagnosis_id, status: 'posted' }, 'entry_number', 1000),
      base44.functions.invoke('getFinancialCanonicalRegistry', {}),
    ]);
    const registryAudit = registryResponse?.data || registryResponse;
    if (!registryAudit?.valid) return Response.json({ error: 'FINANCIAL_REGISTRY_INVALID' }, { status: 503 });

    // 5. Source manifest (uploads ativos)
    const sourceManifest = {
      upload_count: uploads.length,
      upload_ids: uploads.map((u) => u.id),
      analysis_type: diagnosis.analysis_type || 'individual',
      perimeter: perimeter.map(item => ({ entity_id: item.entity_id, entity_type: item.entity_type, role: item.role, control_type: item.control_type, consolidation_method: item.consolidation_method })),
      parent_entity_id: diagnosis.parent_entity_id || null,
      eliminations: eliminations.map(item => ({ id: item.id, period: item.period, entry_type: item.entry_type, debit_canonical_key: item.debit_canonical_key, credit_canonical_key: item.credit_canonical_key, amount: item.amount, status: item.status })),
      formula_version: 'FAL-FIN-3.0.0',
      registry_version: registryAudit.version,
      registry_hash: registryAudit.hash,
      source_heads: sourceHeads,
      source_outputs: sourceOutputs,
      upload_checksums: uploads.map((u) => ({
        id: u.id,
        source_key: u.source_key || null,
        input_checksum: u.input_checksum || null,
        source_entity_id: u.source_entity_id || null,
        source_period: u.source_period || null,
        deletion_status: u.deletion_status || 'active',
        is_current: u.is_current === true,
      })),
    };

    // ── 5.2: Output manifest completo — registros canônicos ordenados ──
    const outputManifest = {
      statement_lines: stmtLines.map((l) => ({
        key: `${l.financial_diagnosis_id}|${l.financial_upload_id || ''}|${l.dataset_scope || ''}|${l.entity_code || ''}|${l.period || ''}|${l.statement_code || ''}|${l.canonical_key || ''}`,
        period: l.period || null,
        entity_code: l.entity_code || null,
        canonical_key: l.canonical_key || null,
        statement_code: l.statement_code || null,
        dataset_scope: l.dataset_scope || null,
        value: Number(l.value) || 0,
      })).sort((a, b) => String(a.key) < String(b.key) ? -1 : 1),
      indicators: indicators.map((i) => ({
        key: `${i.financial_diagnosis_id}|${i.financial_upload_id || i.preparation_run_id || ''}|${i.dataset_scope || ''}|${i.entity_code || ''}|${i.reporting_entity_id || ''}|${i.period || ''}|${i.indicator_code || ''}|${i.formula_version || ''}`,
        period: i.period || null,
        indicator_code: i.indicator_code || null,
        indicator_name: i.indicator_name || null,
        entity_code: i.entity_code || null,
        dataset_scope: i.dataset_scope || null,
        reporting_entity_id: i.reporting_entity_id || null,
        formula_version: i.formula_version || null,
        value: i.value == null ? null : Number(i.value),
      })).sort((a, b) => String(a.key) < String(b.key) ? -1 : 1),
      prepared_lines: preparedLines.map((p) => ({
        key: `${p.financial_diagnosis_id}|${p.processing_run_id || ''}|${p.preparation_run_id || ''}|${p.dataset_scope || ''}|${p.period || ''}|${p.canonical_key || ''}`,
        period: p.period || null, canonical_key: p.canonical_key || null, dataset_scope: p.dataset_scope || null,
        reporting_entity_id: p.reporting_entity_id || null, final_value: Number(p.final_value) || 0,
      })).sort((a, b) => String(a.key).localeCompare(String(b.key))),
      validations: validations.map((v) => ({ key:`${v.code}|${v.dataset_scope || ''}|${v.reporting_entity_id || ''}`, code:v.code, severity:v.severity, blocking:v.blocking === true, dataset_scope:v.dataset_scope || null })),
      mappings: mappings.map((m) => ({ key:`${m.account_code}|${m.managerial_rubric || ''}`, account_code:m.account_code, canonical_key:m.managerial_rubric || null, mapping_source:m.mapping_source, blocking_issue:m.blocking_issue === true })),
      trial_balance: trialLines.map((t) => ({ key:`${t.entity_code}|${t.period}|${t.account_code}`, entity_code:t.entity_code, period:t.period, account_code:t.account_code, closing_balance:Number(t.closing_balance) || 0 })),
      dfc_composition: dfcComposition.map((d) => ({ key:`${d.period}|${d.rubric_key}|${d.bucket}`, period:d.period, comparison_period:d.comparison_period || null, canonical_key:d.canonical_key || null, rubric_key:d.rubric_key, bucket:d.bucket, previous_value:Number(d.previous_value) || 0, current_value:Number(d.current_value) || 0, impact_on_dfc:Number(d.impact_on_dfc) || 0 })),
      eliminations: eliminations.map((e) => ({ id:e.id, period:e.period, debit_canonical_key:e.debit_canonical_key, credit_canonical_key:e.credit_canonical_key, amount:Number(e.amount), status:e.status })),
      registry: { version: sourceManifest.registry_version, hash: sourceManifest.registry_hash, formula_version: sourceManifest.formula_version },
      summary: {
        statement_lines: stmtLines.length,
        indicator_snapshots: indicators.length,
        prepared_lines: preparedLines.length,
        validations: validations.length,
        mappings: mappings.length,
        trial_balance_lines: trialLines.length,
        dfc_composition_lines: dfcComposition.length,
        statement_lines_by_scope: {},
        indicators_by_scope: {},
      },
      diagnosis_periods: {
        first_period: diagnosis.first_period || null,
        last_period: diagnosis.last_period || null,
        months_count: diagnosis.months_count ?? null,
      },
    };
    for (const l of stmtLines) {
      const k = l.dataset_scope || 'individual';
      outputManifest.summary.statement_lines_by_scope[k] = (outputManifest.summary.statement_lines_by_scope[k] || 0) + 1;
    }
    for (const i of indicators) {
      const k = i.dataset_scope || 'individual';
      outputManifest.summary.indicators_by_scope[k] = (outputManifest.summary.indicators_by_scope[k] || 0) + 1;
    }

    // ── 5.3: SHA-256 determinístico ──
    const sourceChecksum = run.input_checksum || await sha256Checksum(sourceManifest);
    const outputChecksum = await sha256Checksum(outputManifest);
    const perimeterChecksum = await sha256Checksum(sourceManifest.perimeter);
    const eliminationChecksum = await sha256Checksum(sourceManifest.eliminations);
    const mappingChecksum = await sha256Checksum(outputManifest.mappings);
    const dfcAdjustmentChecksum = await sha256Checksum(outputManifest.dfc_composition);

    // 8. O predecessor é o snapshot corrente publicado, nunca apenas a maior versão.
    let previousSnapshot = null;
    const previousSnapshotId = previous_snapshot_id || (commit_scope === 'diagnosis' ? diagnosis.current_processing_snapshot_id || null : null);
    if (previousSnapshotId) {
      previousSnapshot = await base44.asServiceRole.entities.FinancialProcessingSnapshot.get(previousSnapshotId);
      if (!previousSnapshot || previousSnapshot.status !== 'active' || previousSnapshot.financial_diagnosis_id !== financial_diagnosis_id || previousSnapshot.financial_processing_run_id === processing_run_id) throw new Error('PREVIOUS_SNAPSHOT_NOT_ACTIVE');
    }
    if (existingSnapshot) {
      const expectedStatus = run.status === 'succeeded' ? 'active' : 'candidate';
      const sourceMatches = JSON.stringify(canonicalize(existingSnapshot.source_manifest)) === JSON.stringify(canonicalize(sourceManifest));
      const outputMatches = JSON.stringify(canonicalize(existingSnapshot.output_manifest)) === JSON.stringify(canonicalize(outputManifest));
      const predecessorMatches = (existingSnapshot.previous_snapshot_id || null) === (previousSnapshotId || null);
      if (existingSnapshot.status !== expectedStatus || !sourceMatches || !outputMatches || existingSnapshot.output_checksum !== outputChecksum || existingSnapshot.input_checksum !== sourceChecksum || !predecessorMatches) {
        return Response.json({ error: 'REUSED_SNAPSHOT_INTEGRITY_FAILED' }, { status: 409 });
      }
      return Response.json({ success: true, reused: true, snapshot_id: existingSnapshot.id, version_number: existingSnapshot.version_number, output_checksum: existingSnapshot.output_checksum, message: 'Snapshot físico revalidado e reutilizado' });
    }
    const allSnapshots = await base44.asServiceRole.entities.FinancialProcessingSnapshot.filter(
      { financial_diagnosis_id }, '-version_number', 1
    );
    const newVersionNumber = Math.max(previousSnapshot?.version_number || 0, allSnapshots[0]?.version_number || 0) + 1;

    // 9. Criar snapshot (IMUTÁVEL)
    const now = new Date().toISOString();
    const snapshot = await base44.asServiceRole.entities.FinancialProcessingSnapshot.create({
      tenant_id: diagnosis.tenant_id,
      financial_diagnosis_id,
      financial_processing_run_id: run.id,
      previous_snapshot_id: previousSnapshotId,
      version_number: newVersionNumber,
      analysis_type: diagnosis.analysis_type || 'individual',
      dataset_scope: run.dataset_scope || resultSummary.dataset_scopes?.join(',') || null,
      reporting_entity_id: run.source_entity_id || diagnosis.parent_entity_id || diagnosis.presenting_entity_id || null,
      perimeter: sourceManifest.perimeter,
      parent_entity_id: sourceManifest.parent_entity_id,
      eliminations: sourceManifest.eliminations,
      statement_counts: outputManifest.summary.statement_lines_by_scope,
      indicator_counts: outputManifest.summary.indicators_by_scope,
      formula_version: sourceManifest.formula_version,
      registry_version: sourceManifest.registry_version,
      registry_hash: sourceManifest.registry_hash,
      perimeter_checksum: perimeterChecksum,
      elimination_checksum: eliminationChecksum,
      mapping_checksum: mappingChecksum,
      dfc_adjustment_checksum: dfcAdjustmentChecksum,
      source_manifest: sourceManifest,
      output_manifest: outputManifest,
      integrity_summary: {
        statement_lines: stmtLines.length,
        indicator_snapshots: indicators.length,
        prepared_lines: preparedLines.length,
      },
      input_checksum: sourceChecksum,
      output_checksum: outputChecksum,
      status: publish_pointer ? 'active' : 'candidate',
      created_at: now,
      created_by: user.email,
    });

    // Pós-condição do snapshot antes de publicá-lo no diagnóstico
    const persistedSnapshot = await base44.asServiceRole.entities.FinancialProcessingSnapshot.get(snapshot.id);
    if (!persistedSnapshot || persistedSnapshot.output_checksum !== outputChecksum || persistedSnapshot.financial_processing_run_id !== run.id) {
      throw new Error('Pós-condição falhou: snapshot persistido diverge do manifesto');
    }

    const updatedSummary = { ...(run.result_summary || {}), snapshot_id: snapshot.id, output_checksum: outputChecksum, snapshot_pending: false };
    await base44.asServiceRole.entities.FinancialProcessingRun.update(processing_run_id, { result_summary: updatedSummary });
    const persistedRun = await base44.asServiceRole.entities.FinancialProcessingRun.get(processing_run_id);
    if (persistedRun?.result_summary?.snapshot_id !== snapshot.id) throw new Error('Pós-condição falhou: run sem snapshot_id');

    // O orquestrador pode adiar a publicação até concluir todas as pós-condições.
    if (publish_pointer) {
      await base44.asServiceRole.entities.FinancialDiagnosis.update(financial_diagnosis_id, { current_processing_snapshot_id: snapshot.id });
      const persistedDiagnosis = await base44.asServiceRole.entities.FinancialDiagnosis.get(financial_diagnosis_id);
      if (persistedDiagnosis.current_processing_snapshot_id !== snapshot.id) throw new Error('Pós-condição falhou: current snapshot não persistido');
    }

    return Response.json({
      success: true, reused: false,
      snapshot_id: snapshot.id,
      version_number: newVersionNumber,
      previous_snapshot_id: previousSnapshotId,
      source_checksum: sourceChecksum,
      output_checksum: outputChecksum,
      mapping_checksum: mappingChecksum,
      registry_hash: sourceManifest.registry_hash,
      registry_version: sourceManifest.registry_version,
      formula_version: sourceManifest.formula_version,
      perimeter_checksum: perimeterChecksum,
      elimination_checksum: eliminationChecksum,
      dfc_adjustment_checksum: dfcAdjustmentChecksum,
      source_manifest: sourceManifest,
      output_manifest: outputManifest,
      preparation_run_ids: preparationRunIds,
      upload_ids: uploadIds,
      run_scoped: true,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});