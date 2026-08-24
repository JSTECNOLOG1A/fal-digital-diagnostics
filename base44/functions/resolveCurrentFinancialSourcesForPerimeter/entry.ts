import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

function resolvePeriod(upload) {
  if (upload.source_period) return upload.source_period;
  try { return JSON.parse(upload.notes || '{}').period_override || null; } catch { return null; }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { diagnosis_id } = await req.json();
    if (!diagnosis_id) return Response.json({ error: 'CURRENT_FINANCIAL_SOURCES_REQUIRED' }, { status: 400 });
    const diagnosis = await base44.entities.FinancialDiagnosis.get(diagnosis_id);
    if (!diagnosis) return Response.json({ error: 'FINANCIAL_DIAGNOSIS_NOT_FOUND' }, { status: 404 });
    const [scope, uploads, heads] = await Promise.all([
      base44.asServiceRole.entities.FinancialAnalysisScopeEntity.filter({ financial_diagnosis_id: diagnosis_id, is_active: true }, 'entity_id', 5000),
      base44.asServiceRole.entities.FinancialUpload.filter({ financial_diagnosis_id: diagnosis_id, is_current: true }, 'id', 50000),
      base44.asServiceRole.entities.FinancialSourceOutputHead.filter({ financial_diagnosis_id: diagnosis_id, status: 'active' }, 'source_key', 50000),
    ]);
    const scopeIds = new Set(scope.map((item) => item.entity_id));
    if (!scopeIds.size) return Response.json({ error: 'CURRENT_FINANCIAL_SOURCE_REQUIRED', reason: 'ACTIVE_SCOPE_REQUIRED' }, { status: 409 });
    const validUploads = uploads.filter((upload) => upload.source_entity_id && resolvePeriod(upload) && scopeIds.has(upload.source_entity_id) && ['validated', 'processed'].includes(upload.upload_status));
    const configuredPeriods = Array.isArray(diagnosis.required_periods) ? diagnosis.required_periods.filter(Boolean) : [];
    const requiredPeriods = configuredPeriods.length ? configuredPeriods : [...new Set(validUploads.map(resolvePeriod))].sort();
    if (!requiredPeriods.length) return Response.json({ error: 'CURRENT_FINANCIAL_UPLOAD_REQUIRED', reason: 'REQUIRED_PERIODS_UNRESOLVED' }, { status: 409 });
    const uploadsByKey = new Map();
    for (const upload of validUploads) {
      const key = `${upload.source_entity_id}|${resolvePeriod(upload)}`;
      if (uploadsByKey.has(key)) return Response.json({ error: 'SOURCE_OUTPUT_HEAD_AMBIGUOUS', source_key: key, reason: 'UPLOAD_MATRIX_AMBIGUOUS' }, { status: 409 });
      uploadsByKey.set(key, upload);
    }
    const expected = new Map();
    for (const entityId of scopeIds) for (const period of requiredPeriods) {
      const key = `${entityId}|${period}`;
      const upload = uploadsByKey.get(key);
      if (!upload) return Response.json({ error: 'CURRENT_FINANCIAL_UPLOAD_REQUIRED', source_key: key, entity_id: entityId, period }, { status: 409 });
      expected.set(key, { upload, source_entity_id: entityId, source_period: period });
    }
    const headsByKey = new Map();
    let staleHeadCount = 0;
    for (const head of heads) {
      const key = `${head.source_entity_id}|${head.source_period}`;
      if (!expected.has(key)) { staleHeadCount += 1; continue; }
      if (headsByKey.has(key)) return Response.json({ error: 'SOURCE_OUTPUT_HEAD_AMBIGUOUS', source_key: key }, { status: 409 });
      headsByKey.set(key, head);
    }
    const sources = [];
    for (const [key, expectedSource] of expected) {
      const head = headsByKey.get(key);
      if (!head) return Response.json({ error: 'CURRENT_FINANCIAL_SOURCE_REQUIRED', source_key: key }, { status: 409 });
      const [snapshot, run, output] = await Promise.all([
        base44.asServiceRole.entities.FinancialProcessingSnapshot.get(head.current_processing_snapshot_id),
        base44.asServiceRole.entities.FinancialProcessingRun.get(head.current_processing_run_id),
        base44.asServiceRole.entities.FinancialStatementLine.filter({ financial_diagnosis_id: diagnosis_id, financial_upload_id: head.financial_upload_id, processing_run_id: head.current_processing_run_id, publication_status: 'active', dataset_scope: 'individual', period: head.source_period }, 'id', 1),
      ]);
      if (!snapshot || snapshot.status !== 'active' || snapshot.financial_processing_run_id !== head.current_processing_run_id || !run || run.status !== 'succeeded' || !output.length || snapshot.output_checksum !== head.current_output_checksum || run.output_checksum !== head.current_output_checksum) return Response.json({ error: 'CURRENT_FINANCIAL_SOURCE_REQUIRED', source_key: key }, { status: 409 });
      sources.push({ source_entity_id: head.source_entity_id, source_period: head.source_period, source_key: head.source_key, financial_upload_id: head.financial_upload_id, processing_run_id: head.current_processing_run_id, snapshot_id: head.current_processing_snapshot_id, input_checksum: head.current_input_checksum || expectedSource.upload.input_checksum || null, output_checksum: head.current_output_checksum, mapping_checksum: head.mapping_checksum || null, registry_hash: head.registry_hash || null, formula_version: head.formula_version || null });
    }
    sources.sort((a, b) => `${a.source_entity_id}|${a.source_period}`.localeCompare(`${b.source_entity_id}|${b.source_period}`));
    return Response.json({ diagnosis_id, expected_source_count: expected.size, resolved_source_count: sources.length, stale_head_count: staleHeadCount, sources });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});