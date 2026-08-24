/**
 * financialProcessingRun.ts — Módulo compartilhado de idempotência (F2-UPL-01).
 *
 * CANONICAL IMPLEMENTATION — each backend function inlines this code because
 * Deno deploy functions execute independently (no local imports at runtime).
 * This file is the single source of truth: tests import from here, and each
 * function entry.ts inlines the exported functions verbatim.
 *
 * Exports:
 *   - computeFinancialOperationKey(...)
 *   - beginOrReuseFinancialRun(...)
 *   - completeFinancialRun(...)
 *   - failFinancialRun(...)
 *
 * Rules (from F2-UPL-01):
 *   - No catch+warn+continue. If run query or create fails, the operation ABORTS.
 *   - beginOrReuse returns { reused, run, existingResult? } — caller must check.
 *   - completeFinancialRun requires run_id, result_summary, output_checksum.
 *   - failFinancialRun updates status=failed|partial_failed + error_details + completed_at.
 */

/**
 * @typedef {Object} OperationKeyParams
 * @property {string} tenantId
 * @property {string} diagnosisId
 * @property {string} [uploadId]
 * @property {string} operationType
 * @property {string} [sourceEntityId]
 * @property {string} [sourcePeriod]
 * @property {string} [inputChecksum]
 */

/**
 * Computes a deterministic, pipe-delimited operation key for idempotency.
 * @param {OperationKeyParams} params
 * @returns {string}
 */
export function computeFinancialOperationKey({
  tenantId,
  diagnosisId,
  uploadId,
  operationType,
  sourceEntityId,
  sourcePeriod,
  inputChecksum,
}) {
  return [
    tenantId || '',
    diagnosisId || '',
    uploadId || '',
    operationType || '',
    sourceEntityId || '',
    sourcePeriod || '',
    inputChecksum || '',
  ].join('|');
}

/**
 * @typedef {Object} BeginRunParams
 * @property {Object} base44 - The base44 SDK client (asServiceRole).
 * @property {string} tenantId
 * @property {string} diagnosisId
 * @property {string} [uploadId]
 * @property {string} operationType
 * @property {string} [sourceEntityId]
 * @property {string} [sourcePeriod]
 * @property {string} [inputChecksum]
 * @property {string} triggeredBy - User email.
 */

/**
 * Begins or reuses a FinancialProcessingRun.
 *
 * Returns:
 *   { reused: true, run: <existingRun> }  — caller returns immediately.
 *   { reused: false, run: <newRun> }       — caller proceeds with processing.
 *
 * THROWS on any failure (no catch+warn+continue). The caller's outer try/catch
 * will convert the thrown error into a 500 response, ensuring no mutation
 * starts without a valid run.
 *
 * @param {BeginRunParams} params
 * @returns {Promise<{reused: boolean, run: Object}>}
 */
export async function beginOrReuseFinancialRun(params) {
  const {
    base44,
    tenantId,
    diagnosisId,
    uploadId,
    operationType,
    sourceEntityId,
    sourcePeriod,
    inputChecksum,
    triggeredBy,
  } = params;

  const operationKey = computeFinancialOperationKey({
    tenantId, diagnosisId, uploadId, operationType, sourceEntityId, sourcePeriod, inputChecksum,
  });

  // 1. Check for existing running or succeeded runs.
  //    This call MUST succeed — if it throws, we abort (no catch+warn+continue).
  const existingRuns = await base44.entities.FinancialProcessingRun.filter(
    { operation_key: operationKey, status: { $in: ['running', 'committing', 'succeeded'] } }, 'id', 10
  );

  if (existingRuns.length > 0) {
    const existing = existingRuns[0];
    return { reused: true, run: existing, operationKey, concurrencyGuarantee: 'best_effort', atomicityVerified: false };
  }

  // 2. No existing run — create a new one.
  //    This call MUST succeed — if it throws, we abort.
  const now = new Date().toISOString();
  const run = await base44.entities.FinancialProcessingRun.create({
    tenant_id: tenantId,
    financial_diagnosis_id: diagnosisId,
    financial_upload_id: uploadId || null,
    operation_type: operationType,
    operation_key: operationKey,
    status: 'running',
    concurrency_guarantee: 'best_effort',
    started_at: now,
    triggered_by: triggeredBy,
    source_entity_id: sourceEntityId || null,
    source_period: sourcePeriod || null,
    input_checksum: inputChecksum || null,
  });

  return { reused: false, run, operationKey, concurrencyGuarantee: 'best_effort', atomicityVerified: false };
}

/**
 * Completes a FinancialProcessingRun with status=succeeded.
 *
 * @param {Object} base44 - The base44 SDK client (asServiceRole).
 * @param {string} runId
 * @param {Object} resultSummary
 * @param {string} outputChecksum
 * @returns {Promise<void>}
 */
export async function completeFinancialRun(base44, runId, resultSummary, outputChecksum) {
  if (!runId) throw new Error('completeFinancialRun: runId is required');
  await base44.entities.FinancialProcessingRun.update(runId, {
    status: 'succeeded',
    completed_at: new Date().toISOString(),
    result_summary: resultSummary,
    output_checksum: outputChecksum || null,
  });
}

/**
 * Fails a FinancialProcessingRun with status=failed or partial_failed.
 *
 * @param {Object} base44 - The base44 SDK client (asServiceRole).
 * @param {string} runId
 * @param {string} errorMsg
 * @param {string} [status='failed'] - 'failed' or 'partial_failed'
 * @param {Object} [extraErrorDetails]
 * @returns {Promise<void>}
 */
export async function failFinancialRun(base44, runId, errorMsg, status = 'failed', extraErrorDetails = {}) {
  if (!runId) return; // Nothing to fail if no run was created.
  await base44.entities.FinancialProcessingRun.update(runId, {
    status,
    completed_at: new Date().toISOString(),
    error_details: { error: errorMsg, ...extraErrorDetails },
    result_summary: { success: false, error: errorMsg },
  });
}

// ── SHA-256 canonical checksum (F2-SNP-01 §5.3) ──────────────────────────────

/**
 * Canonical serialization for deterministic SHA-256:
 *   - sort array elements by a stable key
 *   - sort object keys alphabetically
 *   - normalize numbers (round to 2 decimal places)
 *   - exclude non-deterministic fields (timestamps, ids)
 *
 * @param {*} value
 * @returns {*} canonicalized value
 */
export function canonicalize(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Math.round(value * 100) / 100; // normalize to 2 decimal places
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    // Sort arrays of objects by a 'key' field if present, else by JSON string
    const sorted = [...value].sort((a, b) => {
      const ka = (a && typeof a === 'object' && a.key) ? a.key : JSON.stringify(canonicalize(a));
      const kb = (b && typeof b === 'object' && b.key) ? b.key : JSON.stringify(canonicalize(b));
      return String(ka) < String(kb) ? -1 : String(ka) > String(kb) ? 1 : 0;
    });
    return sorted.map(canonicalize);
  }
  // Object: sort keys alphabetically, exclude non-deterministic fields
  const excluded = new Set(['created_date', 'updated_date', 'created_by_id', 'id', 'created_at', 'updated_at']);
  const result = {};
  for (const key of Object.keys(value).sort()) {
    if (excluded.has(key)) continue;
    result[key] = canonicalize(value[key]);
  }
  return result;
}

/**
 * Computes SHA-256 hash of a value using canonical serialization.
 * Uses Web Crypto API (SubtleCrypto) — available in Deno.
 *
 * @param {*} value
 * @returns {Promise<string>} hex-encoded SHA-256 hash
 */
export async function sha256Checksum(value) {
  const canonical = JSON.stringify(canonicalize(value));
  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}