import { describe, it, expect } from 'vitest';
import { runDeleteWorkflow } from '@/lib/financial/deleteFinancialUploadWorkflow';
import { createInMemoryDeleteRepository } from '@/lib/financial/testing/createInMemoryDeleteRepository';
import { assertFullIntegrityResponse, lookupReplacementRun } from '@/lib/financial/replaceFinancialSourcePeriodContracts';

describe('R6-IDEMPOTENCY — sem garantia atômica fictícia', () => {
  it('reutiliza operação concluída em retry sequencial', async () => {
    const repository = createInMemoryDeleteRepository();
    await runDeleteWorkflow({ repository, diagnosisId: 'd1', uploadId: 'u1', actor: 'admin' });
    const retry = await runDeleteWorkflow({ repository, diagnosisId: 'd1', uploadId: 'u1', actor: 'admin' });
    expect(retry).toMatchObject({ reused: true, status: 'succeeded', concurrency_guarantee: 'best_effort', atomicity_verified: false });
    expect(repository.state.runs).toHaveLength(1);
  });

  it('falha com 503 e zero mutations quando lookup de run está indisponível', async () => {
    const repository = createInMemoryDeleteRepository({ failRunLookup: true });
    const result = await runDeleteWorkflow({ repository, diagnosisId: 'd1', uploadId: 'u1', actor: 'admin' });
    expect(result).toMatchObject({ error: 'PROCESSING_RUN_LOOKUP_UNAVAILABLE', http_status: 503, mutations: 0, concurrency_guarantee: 'best_effort', atomicity_verified: false });
    expect(repository.state.mutations).toBe(0);
  });
});

describe('R7-REPLACE-FAIL-CLOSED', () => {
  it('retorna 503 sem mutation nem criação de run quando lookup falha', async () => {
    let mutations = 0;
    let creates = 0;
    const repository = { findRuns: async () => { throw new Error('unavailable'); }, mutate: () => { mutations += 1; }, createRun: () => { creates += 1; } };
    const result = await lookupReplacementRun(repository, 'key');
    expect(result.status).toBe(503);
    expect(result).toMatchObject({ error: 'PROCESSING_RUN_LOOKUP_UNAVAILABLE', mutation_executed: false, concurrency_guarantee: 'best_effort', atomicity_verified: false });
    expect(mutations).toBe(0);
    expect(creates).toBe(0);
  });
});

describe('R7-INTEGRITY-RESPONSE', () => {
  it.each([
    [null, 'FULL_INTEGRITY_EMPTY_RESPONSE'],
    [undefined, 'FULL_INTEGRITY_EMPTY_RESPONSE'],
    [{}, 'FULL_INTEGRITY_NOT_HEALTHY'],
    [{ is_healthy: false, blocking_issues: [] }, 'FULL_INTEGRITY_NOT_HEALTHY'],
    [{ is_healthy: true }, 'FULL_INTEGRITY_UNEXPECTED_FORMAT'],
    [{ is_healthy: true, blocking_issues: {} }, 'FULL_INTEGRITY_UNEXPECTED_FORMAT'],
    [{ is_healthy: true, blocking_issues: [{ code: 'BLOCK' }] }, 'FULL_INTEGRITY_BLOCKED'],
  ])('bloqueia resposta inválida %#', (payload, code) => {
    expect(() => assertFullIntegrityResponse(payload)).toThrow(code);
  });

  it('aceita somente resposta saudável e estruturada', () => {
    expect(assertFullIntegrityResponse({ data: { is_healthy: true, blocking_issues: [] } })).toEqual({ is_healthy: true, blocking_issues: [] });
  });
});