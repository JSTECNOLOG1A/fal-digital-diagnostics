const ENGINE_VERSION = 'FAL-FIN-LIFECYCLE-1.0.0';
const CONTRACT_HASH = '8eb5018d13d3ebaab59985b504e7bda63bbbc9f5f9e75c5453d5c7a61dfc29e9';

function canonicalize(value) {
  if (value === null || value === undefined || typeof value !== 'object') return value ?? null;
  if (Array.isArray(value)) return value.map(canonicalize);
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

async function fingerprint(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function selectCandidates(input) {
  const selectedBySourceKey = {}; const ambiguousSourceKeys = []; const rejectedCandidates = [];
  for (const item of input.source_keys || []) {
    const candidates = (item.candidates || []).filter((candidate) => candidate.run_status === 'succeeded' && candidate.snapshot_status === 'active' && candidate.snapshot_id && candidate.processing_run_id && candidate.run_output_checksum === candidate.snapshot_output_checksum);
    const existing = candidates.find((candidate) => candidate.processing_run_id === item.existing_head?.current_processing_run_id && candidate.snapshot_id === item.existing_head?.current_processing_snapshot_id && candidate.snapshot_output_checksum === item.existing_head?.current_output_checksum);
    const pointed = candidates.find((candidate) => candidate.processing_run_id === input.diagnosis_current_run_id);
    const ordered = [...candidates].sort((a, b) => Number(b.snapshot_version_number || 0) - Number(a.snapshot_version_number || 0) || String(b.run_completed_at || '').localeCompare(String(a.run_completed_at || '')) || String(b.snapshot_created_at || '').localeCompare(String(a.snapshot_created_at || '')));
    const selected = existing || pointed || ordered[0] || null;
    if (!selected) { rejectedCandidates.push({ source_key: item.source_key, reason_code: 'NO_VALID_CANDIDATE' }); continue; }
    if (!existing && !pointed && ordered[1] && Number(ordered[1].snapshot_version_number || 0) === Number(selected.snapshot_version_number || 0) && String(ordered[1].run_completed_at || '') === String(selected.run_completed_at || '') && String(ordered[1].snapshot_created_at || '') === String(selected.snapshot_created_at || '')) {
      ambiguousSourceKeys.push({ source_key: item.source_key, candidate_run_ids: ordered.filter((candidate) => Number(candidate.snapshot_version_number || 0) === Number(selected.snapshot_version_number || 0) && String(candidate.run_completed_at || '') === String(selected.run_completed_at || '') && String(candidate.snapshot_created_at || '') === String(selected.snapshot_created_at || '')).map((candidate) => candidate.processing_run_id) });
      continue;
    }
    selectedBySourceKey[item.source_key] = { ...selected, selection_reason: existing ? 'COHERENT_EXISTING_HEAD' : pointed ? 'COHERENT_DIAGNOSIS_POINTER' : 'HIGHEST_FORMAL_VERSION' };
  }
  return { selected_by_source_key: selectedBySourceKey, ambiguous_source_keys: ambiguousSourceKeys, rejected_candidates: rejectedCandidates };
}

function buildLineage(input) {
  const sourceOutputs = new Map();
  const sourceHeadsManifest = (input.source_heads || []).map((head) => {
    const explicit = { source_key: head.source_key, source_entity_id: head.source_entity_id, source_period: head.source_period, financial_upload_id: head.financial_upload_id, processing_run_id: head.current_processing_run_id, snapshot_id: head.current_processing_snapshot_id, input_checksum: head.current_input_checksum || null, output_checksum: head.current_output_checksum, mapping_checksum: head.mapping_checksum || null, registry_hash: head.registry_hash || null, formula_version: head.formula_version || null };
    const inherited = input.snapshot_source_outputs?.[head.current_processing_snapshot_id] || [];
    for (const output of [...inherited, explicit]) sourceOutputs.set([output.source_key, output.processing_run_id, output.snapshot_id].join('|'), output);
    return { ...explicit, dataset_scope: input.analysis_type, previous_processing_run_id: head.current_processing_run_id, previous_snapshot_id: head.current_processing_snapshot_id, previous_output_checksum: head.current_output_checksum, previous_input_checksum: head.current_input_checksum || null };
  });
  const predecessorIds = [...new Set(sourceHeadsManifest.map((head) => head.previous_snapshot_id).filter(Boolean))];
  return { previous_snapshot_id: predecessorIds.length === 1 ? predecessorIds[0] : null, source_heads_manifest: sourceHeadsManifest, source_outputs: [...sourceOutputs.values()].sort((a, b) => `${a.source_entity_id}|${a.source_period}|${a.source_key}`.localeCompare(`${b.source_entity_id}|${b.source_period}|${b.source_key}`)), cleanup_targets: sourceHeadsManifest.map((head) => ({ previous_processing_run_id: head.previous_processing_run_id, source_key: head.source_key, source_entity_id: head.source_entity_id, source_period: head.source_period, financial_upload_id: head.financial_upload_id, dataset_scope: head.dataset_scope })) };
}

function evaluateCleanup(input) {
  if (input.cleanup_attempt_result?.error) return { action: 'RETRY', cleanup_pending: true, reason_code: input.cleanup_attempt_result.error };
  if ((input.active_source_head_references || []).length || input.diagnosis_pointer_reference === input.previous_run_id) return { action: 'DEFER', cleanup_pending: true, reason_code: 'CLEANUP_DEFERRED_CURRENT_REFERENCE' };
  return { action: 'SUPERSEDE_RUN', cleanup_pending: false, reason_code: 'CLEANUP_READY' };
}

function mergeDelta(input) {
  const previous = structuredClone(input.accumulated_stats || {}); const delta = input.diagnosis_delta || {};
  if (!input.diagnosis_completed) return { accumulated_stats: { ...previous, rows_failed: Number(previous.rows_failed || 0) + 1 }, last_completed_cursor: input.previous_cursor || null, merged: false };
  const merged = { ...previous };
  for (const [key, value] of Object.entries(delta)) {
    if (['before_by_entity_status', 'after_by_entity_status'].includes(key)) {
      merged[key] = { ...(merged[key] || {}) }; for (const [status, count] of Object.entries(value || {})) merged[key][status] = Number(merged[key][status] || 0) + Number(count || 0);
    } else if (Array.isArray(value)) merged[key] = [...(merged[key] || []), ...value];
    else if (typeof value === 'number') merged[key] = Number(merged[key] || 0) + value;
  }
  merged.diagnostics_migrated = Number(merged.diagnostics_migrated || 0) + 1;
  return { accumulated_stats: merged, last_completed_cursor: input.new_cursor || input.previous_cursor || null, merged: true };
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    if (payload.contract_version !== ENGINE_VERSION) return Response.json({ error: 'FINANCIAL_LIFECYCLE_ENGINE_CONTRACT_MISMATCH' }, { status: 409 });
    const input = payload.input || {}; const inputFingerprint = await fingerprint(input);
    let decision; let reasonCodes = [];
    if (payload.operation === 'select_current_legacy_candidates') { decision = selectCandidates(input); reasonCodes = decision.ambiguous_source_keys.length ? ['HEAD_AMBIGUOUS'] : []; }
    else if (payload.operation === 'build_dfc_lineage_manifest') decision = buildLineage(input);
    else if (payload.operation === 'evaluate_cleanup_state') decision = evaluateCleanup(input);
    else if (payload.operation === 'merge_migration_diagnosis_delta') decision = mergeDelta(input);
    else return Response.json({ error: 'FINANCIAL_LIFECYCLE_ENGINE_OPERATION_UNSUPPORTED' }, { status: 400 });
    return Response.json({ success: true, engine_version: ENGINE_VERSION, contract_hash: CONTRACT_HASH, operation: payload.operation, decision, reason_codes: reasonCodes, input_fingerprint: inputFingerprint, output_fingerprint: await fingerprint(decision) });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
});