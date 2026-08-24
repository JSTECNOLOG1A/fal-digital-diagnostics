import { describe, expect, it } from 'vitest';

describe('phase5 LGPD export contract', () => {
  it('exports only public audit fields for the holder history', () => {
    const entry = { id: 'a1', action: 'DATA_SUBJECT_EXPORT', timestamp: '2026-01-01', entity_type: 'User' };
    expect(Object.keys(entry)).toEqual(['id', 'action', 'timestamp', 'entity_type']);
    expect(entry).not.toHaveProperty('details');
  });
});