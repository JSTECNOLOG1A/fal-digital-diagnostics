import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { diagnosis_id } = await req.json();
    if (!diagnosis_id) return Response.json({ error: 'CURRENT_FINANCIAL_SNAPSHOT_REQUIRED' }, { status: 400 });
    const diagnosis = await base44.entities.FinancialDiagnosis.get(diagnosis_id);
    if (!diagnosis?.current_processing_snapshot_id) return Response.json({ error: 'CURRENT_FINANCIAL_SNAPSHOT_REQUIRED' }, { status: 409 });
    const snapshot = await base44.entities.FinancialProcessingSnapshot.get(diagnosis.current_processing_snapshot_id);
    if (!snapshot || snapshot.status !== 'active' || snapshot.financial_diagnosis_id !== diagnosis_id || !snapshot.financial_processing_run_id) return Response.json({ error: 'CURRENT_FINANCIAL_SNAPSHOT_INVALID' }, { status: 409 });
    const run = await base44.entities.FinancialProcessingRun.get(snapshot.financial_processing_run_id);
    if (!run || run.status !== 'succeeded' || run.financial_diagnosis_id !== diagnosis_id || (run.output_checksum && run.output_checksum !== snapshot.output_checksum)) return Response.json({ error: 'CURRENT_FINANCIAL_RUN_MISMATCH' }, { status: 409 });
    if (!snapshot.output_checksum || !run.output_checksum) return Response.json({ error: 'CURRENT_FINANCIAL_OUTPUT_CHECKSUM_REQUIRED' }, { status: 409 });
    return Response.json({ diagnosis_id, snapshot_id:snapshot.id, processing_run_id:run.id, snapshot_status:snapshot.status, output_checksum:snapshot.output_checksum, registry_version:snapshot.registry_version || run.registry_version || null, formula_version:snapshot.formula_version || run.formula_version || null, mapping_checksum:snapshot.mapping_checksum || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});