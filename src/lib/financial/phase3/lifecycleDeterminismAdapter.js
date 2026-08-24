export const FINANCIAL_LIFECYCLE_ENGINE_VERSION = 'FAL-FIN-LIFECYCLE-1.0.0';
export const FINANCIAL_LIFECYCLE_CONTRACT_HASH = '8eb5018d13d3ebaab59985b504e7bda63bbbc9f5f9e75c5453d5c7a61dfc29e9';

async function fingerprint(value) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))); return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join(''); }

export async function invokeFinancialLifecycleEngine(base44, operation, input) {
  const response = await base44.functions.invoke('financialLifecycleDeterminismEngine', { contract_version: FINANCIAL_LIFECYCLE_ENGINE_VERSION, operation, input });
  const result = response?.data || response;
  if (!result?.success || result.engine_version !== FINANCIAL_LIFECYCLE_ENGINE_VERSION || result.contract_hash !== FINANCIAL_LIFECYCLE_CONTRACT_HASH || result.operation !== operation || result.input_fingerprint !== await fingerprint(input)) throw new Error('FINANCIAL_LIFECYCLE_ENGINE_CONTRACT_MISMATCH');
  return result;
}