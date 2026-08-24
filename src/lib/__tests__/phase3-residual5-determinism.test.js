import { expect, it } from 'vitest';
import { FINANCIAL_LIFECYCLE_CONTRACT_HASH, FINANCIAL_LIFECYCLE_ENGINE_VERSION, invokeFinancialLifecycleEngine } from '@/lib/financial/phase3/lifecycleDeterminismAdapter';

it('fails closed when a canonical engine response is not successful', async () => {
  const base44 = { functions: { invoke: async () => ({ data: { success: false, engine_version: FINANCIAL_LIFECYCLE_ENGINE_VERSION, contract_hash: FINANCIAL_LIFECYCLE_CONTRACT_HASH, operation: 'evaluate_cleanup_state' } }) } };
  await expect(invokeFinancialLifecycleEngine(base44, 'evaluate_cleanup_state', {})).rejects.toThrow('FINANCIAL_LIFECYCLE_ENGINE_CONTRACT_MISMATCH');
});