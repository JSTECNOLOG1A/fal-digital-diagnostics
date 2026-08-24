const EXCLUDED_OPERATIONAL_FIELDS = new Set(['created_date','created_at','created_by_id','published_at','superseded_at','invalidated_at']);
const LOGICAL_KEYS = ['logical_key','canonical_key','indicator_code','rubric_key','account_code','entity_id','id','period'];

function normalizeNumber(value) {
  if (!Number.isFinite(value)) throw new Error('CANONICAL_NON_FINITE_NUMBER');
  return Object.is(value, -0) ? 0 : Number(value.toPrecision(15));
}

export function canonicalize(value) {
  if (value === null) return null;
  if (value === undefined) return null;
  if (typeof value === 'number') return normalizeNumber(value);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map(canonicalize).sort((a, b) => {
      const key = (item) => LOGICAL_KEYS.map((field) => item?.[field] ?? '').join('|') || JSON.stringify(item);
      return key(a).localeCompare(key(b));
    });
  }
  return Object.fromEntries(Object.keys(value).filter((key) => !EXCLUDED_OPERATIONAL_FIELDS.has(key)).sort().map((key) => [key, canonicalize(value[key])]));
}

export function canonicalSerialize(value) { return JSON.stringify(canonicalize(value)); }

export async function sha256Canonical(value) {
  const bytes = new TextEncoder().encode(canonicalSerialize(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function buildOperationIdentity(operation, input) {
  const input_checksum = await sha256Canonical({ operation, ...input });
  return { operation, input_checksum, operation_key: `${operation}|sha256:${input_checksum}` };
}