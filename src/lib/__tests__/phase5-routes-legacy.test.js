import { describe, expect, it } from 'vitest';
import { getRoutePolicy } from '@/lib/routePolicies';

describe('F5-UX-02 routes and legacy', () => {
  it('keeps operational onboarding guarded and admin routes non-public', () => {
    expect(getRoutePolicy('Onboarding')).toEqual({ requireWrite: true });
    expect(getRoutePolicy('Tenants')).toEqual({ requireHQ: true });
    expect(getRoutePolicy('unknown-route')).toEqual({ requireWrite: true });
  });
});