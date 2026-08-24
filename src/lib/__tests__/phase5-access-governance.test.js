import { describe, expect, it } from 'vitest';
import { canManageAccess, redactSensitive, resolveAppRole } from '../../../base44/shared/accessGovernance.ts';

describe('F5-USR-01 access governance', () => {
  it('denies revoked identities and preserves tenant administration boundaries', () => {
    expect(resolveAppRole({ app_role: 'consultant', access_status: 'revoked' })).toBeNull();
    expect(canManageAccess({ id: 'a', app_role: 'tenant_admin', tenant_id: 't1' }, { id: 'b', app_role: 'consultant', tenant_id: 't1', role: 'user' })).toBe(true);
    expect(canManageAccess({ id: 'a', app_role: 'tenant_admin', tenant_id: 't1' }, { id: 'b', app_role: 'consultant', tenant_id: 't2', role: 'user' })).toBe(false);
  });
});

describe('F5-OBS-02 support bundle privacy', () => {
  it('redacts secrets and personal identifiers recursively', () => {
    expect(redactSensitive({ password: 'x', email: 'a@b.com', safe: { token: 'y', label: 'ok' } })).toEqual({ password: '[REDACTED]', email: '[REDACTED]', safe: { token: '[REDACTED]', label: 'ok' } });
  });
});