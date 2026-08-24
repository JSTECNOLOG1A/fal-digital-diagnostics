import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';

describe('financial reader audit', () => {
  it('classifies every production versioned reader', () => {
    expect(execFileSync('node', ['scripts/assert-financial-current-output-readers.mjs'], { encoding: 'utf8' })).toContain('failures=0');
  });
});