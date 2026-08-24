import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';

describe('financial writer lifecycle audit', () => {
  it('requires run and publication metadata for every writer', () => {
    expect(execFileSync('node', ['scripts/assert-financial-writer-lifecycle.mjs'], { encoding: 'utf8' })).toContain('failures=0');
  });
});