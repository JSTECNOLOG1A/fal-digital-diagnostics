import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync('base44/functions/createFinancialProcessingSnapshot/entry.ts', 'utf8');
describe('financial snapshot immutability', () => {
  it('creates snapshots and never updates historical snapshot content', () => {
    expect(source).toContain('FinancialProcessingSnapshot.create');
    expect(source).not.toMatch(/FinancialProcessingSnapshot\.update\([^\n]*source_manifest/);
  });
});