import { expect, it } from 'vitest';
import { FINANCIAL_LIFECYCLE_CONTRACT_HASH, FINANCIAL_LIFECYCLE_ENGINE_VERSION, invokeFinancialLifecycleEngine } from '@/lib/financial/phase3/lifecycleDeterminismAdapter';

it('validates the canonical engine response contract before a consumer can use a decision', async () => {
  const input = { source_keys: [] };
  const base44 = { functions: { invoke: async () => ({ data: { success: true, engine_version: FINANCIAL_LIFECYCLE_ENGINE_VERSION, contract_hash: FINANCIAL_LIFECYCLE_CONTRACT_HASH, operation: 'select_current_legacy_candidates', input_fingerprint: 'ce25f46734efc2e4c960d6a99a3c88f45ef8c8753830c3043b781c16dc6cfb9b', decision: { selected_by_source_key: {} } } }) } };
  await expect(invokeFinancialLifecycleEngine(base44, 'select_current_legacy_candidates', input)).resolves.toMatchObject({ decision: { selected_by_source_key: {} } });
});