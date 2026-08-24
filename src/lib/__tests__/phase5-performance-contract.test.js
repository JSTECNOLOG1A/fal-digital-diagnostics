import { describe, expect, it } from 'vitest';
import { compareMeasurements, isTenantScopedKey } from '@/lib/phase5/performanceContracts';

describe('phase5 performance contract', () => {
  it('reports comparable volume fixture deltas', () => expect(compareMeasurements({ requests: 12, tab_requests: 4, screen_time_ms: 400, chunks: 5 }, { requests: 8, tab_requests: 2, screen_time_ms: 280, chunks: 4 })).toEqual({ request_delta: -4, tab_request_delta: -2, screen_time_delta_ms: -120, chunk_delta: -1 }));
  it('does not share cache keys across tenants', () => { expect(isTenantScopedKey(['tenant', 't1', 'group'], 't1')).toBe(true); expect(isTenantScopedKey(['tenant', 't1', 'group'], 't2')).toBe(false); });
});