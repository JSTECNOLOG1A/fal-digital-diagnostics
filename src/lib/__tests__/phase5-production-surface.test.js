import { describe, expect, it } from 'vitest';
import packageJson from '../../../package.json';

describe('F5-REL-01 production surface', () => {
  it('pins the approved PDF version and exposes the readiness audit', () => {
    expect(packageJson.dependencies.jspdf).toBe('4.2.1');
    expect(packageJson.scripts['audit:phase5-product-readiness']).toContain('audit-phase5-product-readiness');
  });
});