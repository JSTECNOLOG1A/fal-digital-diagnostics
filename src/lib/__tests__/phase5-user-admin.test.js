import { describe, expect, it } from 'vitest';
import { canManageTenantAdministration } from '@/lib/phase5/adminPolicy';

describe('phase5 user administration', () => {
  it('prevents consultants and cross-tenant administrators from managing access', () => {
    expect(canManageTenantAdministration('consultant', 't1', 't1')).toBe(false);
    expect(canManageTenantAdministration('tenant_admin', 't1', 't2')).toBe(false);
    expect(canManageTenantAdministration('tenant_admin', 't1', 't1')).toBe(true);
  });
});