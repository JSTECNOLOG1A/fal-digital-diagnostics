import { describe, expect, it } from 'vitest';
import { createFailureController } from '@/lib/phase4/failurePlan';
import { createInMemoryRepository } from '@/lib/phase4/inMemoryBase44Repository';
import { createDeterministicRuntime } from '@/lib/phase4/deterministicRuntime';

describe('R4 deterministic scenario harness primitives', () => {
  it('tracks deterministic time and UUID usage', () => {
    const runtime = createDeterministicRuntime({ now: '2026-07-20T12:00:00.000Z', uuidSequence: ['uuid-0001'] });
    expect(runtime.now().toISOString()).toBe('2026-07-20T12:00:00.000Z');
    expect(runtime.randomUUID()).toBe('uuid-0001');
    expect(runtime.clockCalls).toHaveLength(1);
    expect(runtime.uuidCalls).toEqual(['uuid-0001']);
    expect(() => runtime.randomUUID()).toThrow('DETERMINISTIC_UUID_EXHAUSTED');
  });

  it('records before and after failure mutations', async () => {
    const controller = createFailureController({ 'Sample.update': { after: { atCall: 1, message: 'FAIL_AFTER' } } });
    const repository = createInMemoryRepository({ Sample: [{ id: 'sample-1', status: 'todo' }] }, controller);
    await expect(repository.entities.Sample.update('sample-1', { status: 'done' })).rejects.toThrow('FAIL_AFTER');
    expect(repository.state.Sample[0].status).toBe('done');
    expect(repository.mutations[0]).toMatchObject({ entity: 'Sample', method: 'update', committed: true, failedAfter: true });
  });
});