import { expect, it } from 'vitest';
import { FINANCIAL_LIFECYCLE_CONTRACT_HASH, FINANCIAL_LIFECYCLE_ENGINE_VERSION, invokeFinancialLifecycleEngine } from '@/lib/financial/phase3/lifecycleDeterminismAdapter';

it('requires the matching operation from the canonical DFC lineage engine', async () => {
  const base44 = { functions: { invoke: async () => ({ data: { success: true, engine_version: FINANCIAL_LIFECYCLE_ENGINE_VERSION, contract_hash: FINANCIAL_LIFECYCLE_CONTRACT_HASH, operation: 'wrong_operation' } }) } };
  await expect(invokeFinancialLifecycleEngine(base44, 'build_dfc_lineage_manifest', { source_heads: [] })).rejects.toThrow('FINANCIAL_LIFECYCLE_ENGINE_CONTRACT_MISMATCH');
});