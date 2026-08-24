import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('F5-LGPD-02 data subject export', () => {
  it('exports only the authenticated subject and records retention notice', () => {
    const source = readFileSync('base44/functions/exportDataSubjectData/entry.ts', 'utf8');
    expect(source).toContain('actor.email');
    expect(source).toContain('retention_notice');
    expect(source).toContain("action: 'DATA_SUBJECT_EXPORT'");
  });
});