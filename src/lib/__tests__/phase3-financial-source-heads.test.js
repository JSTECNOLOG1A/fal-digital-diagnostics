import { describe, expect, it } from 'vitest';

function commitHeads(store, changes) {
  const previous = new Map(store);
  try {
    for (const change of changes) store.set(change.key, change);
  } catch (error) {
    store.clear();
    for (const [key, value] of previous) store.set(key, value);
    throw error;
  }
}

describe('source-head commit scope', () => {
  it('preserves A while B is built and supersedes only B on rebuild', () => {
    const heads = new Map([['A|2025', { key: 'A|2025', run: 'run-a' }]]);
    commitHeads(heads, [{ key: 'B|2025', run: 'run-b1' }]);
    expect(heads.get('A|2025').run).toBe('run-a');
    commitHeads(heads, [{ key: 'B|2025', run: 'run-b2', previousRun: 'run-b1' }]);
    expect(heads.get('A|2025').run).toBe('run-a');
    expect(heads.get('B|2025')).toMatchObject({ run: 'run-b2', previousRun: 'run-b1' });
  });
  it('commits multiple periods of A to the same run', () => {
    const heads = new Map();
    commitHeads(heads, [{ key: 'A|2024', run: 'run-a-batch' }, { key: 'A|2025', run: 'run-a-batch' }]);
    expect([...heads.values()].map((head) => head.run)).toEqual(['run-a-batch', 'run-a-batch']);
  });
});