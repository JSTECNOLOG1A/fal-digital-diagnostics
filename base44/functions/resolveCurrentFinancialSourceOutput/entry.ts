import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { diagnosis_id, source_entity_id, source_period } = await req.json();
    if (!diagnosis_id || !source_entity_id || !source_period) return Response.json({ error: 'SOURCE_OUTPUT_SCOPE_REQUIRED' }, { status: 400 });
    const diagnosis = await base44.entities.FinancialDiagnosis.get(diagnosis_id);
    if (!diagnosis) return Response.json({ error: 'FINANCIAL_DIAGNOSIS_NOT_FOUND' }, { status: 404 });
    const heads = await base44.entities.FinancialSourceOutputHead.filter({ financial_diagnosis_id: diagnosis_id, source_entity_id, source_period, status: 'active' }, 'updated_at', 2);
    if (heads.length !== 1) return Response.json({ error: heads.length ? 'SOURCE_OUTPUT_HEAD_AMBIGUOUS' : 'SOURCE_OUTPUT_HEAD_REQUIRED' }, { status: 409 });
    const head = heads[0];
    const [snapshot, run, outputs] = await Promise.all([
      base44.entities.FinancialProcessingSnapshot.get(head.current_processing_snapshot_id),
      base44.entities.FinancialProcessingRun.get(head.current_processing_run_id),
      base44.entities.FinancialStatementLine.filter({ financial_diagnosis_id: diagnosis_id, processing_run_id: head.current_processing_run_id, financial_upload_id: head.financial_upload_id, period: source_period, publication_status: 'active', dataset_scope: 'individual' }, 'id', 1),
    ]);
    if (!snapshot || snapshot.status !== 'active' || snapshot.financial_diagnosis_id !== diagnosis_id || snapshot.financial_processing_run_id !== head.current_processing_run_id) return Response.json({ error: 'SOURCE_OUTPUT_SNAPSHOT_INVALID' }, { status: 409 });
    if (!run || run.status !== 'succeeded' || run.output_checksum !== head.current_output_checksum || snapshot.output_checksum !== head.current_output_checksum) return Response.json({ error: 'SOURCE_OUTPUT_RUN_MISMATCH' }, { status: 409 });
    if (!outputs.length) return Response.json({ error: 'SOURCE_OUTPUTS_REQUIRED' }, { status: 409 });
    return Response.json({ diagnosis_id, source_entity_id, source_period, source_key: head.source_key, financial_upload_id: head.financial_upload_id, processing_run_id: head.current_processing_run_id, snapshot_id: head.current_processing_snapshot_id, input_checksum: head.current_input_checksum || null, output_checksum: head.current_output_checksum, mapping_checksum: head.mapping_checksum || null, registry_hash: head.registry_hash || null, formula_version: head.formula_version || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});