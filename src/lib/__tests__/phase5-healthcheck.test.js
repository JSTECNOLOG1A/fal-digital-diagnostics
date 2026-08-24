import { describe, expect, it } from 'vitest';
import { buildHealthPayload } from '../../../base44/shared/healthContract.ts';

describe('F5-OBS-03 authenticated healthcheck contract', () => {
  it('reports a versioned healthy state only when required services are operational', () => {
    const healthy = buildHealthPayload({ authentication: 'operational', database: 'operational', storage: 'not_checked', integrations: 'not_checked' });
    expect(healthy).toMatchObject({ status: 'healthy', version: 'FAL-v2.62', services: { database: 'operational' } });
    expect(healthy.build_sha).toMatch(/^[a-f0-9]{64}$/);
    expect(buildHealthPayload({ database: 'degraded' }).status).toBe('degraded');
  });
});