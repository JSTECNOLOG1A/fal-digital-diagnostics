import { describe, expect, it } from 'vitest';
import { createFailureController } from '@/lib/phase4/failurePlan';
import { createInMemoryRepository } from '@/lib/phase4/inMemoryBase44Repository';

const rows = Array.from({ length: 501 }, (_, index) => ({ id: String(index + 1).padStart(3, '0'), value: index + 1, created_date: `2026-07-20T${String(index % 24).padStart(2, '0')}:00:00.000Z` }));

describe('R4 productive harness repository', () => {
  it('supports query operators, descending sort and pagination', async () => {
    const repository = createInMemoryRepository({ Sample: rows });
    const filtered = await repository.entities.Sample.filter({ value: { $gt: 499, $in: [500, 501] } }, '-id', 1);
    expect(filtered[0].id).toBe('501');
    const firstPage = await repository.entities.Sample.filter({}, 'id', 500);
    const secondPage = await repository.entities.Sample.filter({ id: { $gt: firstPage.at(-1).id } }, 'id', 500);
    expect(secondPage).toHaveLength(1);
    expect(repository.entityCalls.filter((call) => call.method === 'filter')).toHaveLength(3);
  });

  it('fails only on the configured occurrence', async () => {
    const controller = createFailureController({ 'Sample.create': { atCall: 3, message: 'FAIL_CREATE_3' } });
    const repository = createInMemoryRepository({}, controller);
    await repository.entities.Sample.create({ value: 1 });
    await repository.entities.Sample.create({ value: 2 });
    await expect(repository.entities.Sample.create({ value: 3 })).rejects.toThrow('FAIL_CREATE_3');
    expect(controller.failures[0]).toMatchObject({ key: 'Sample.create', callNumber: 3 });
  });
});