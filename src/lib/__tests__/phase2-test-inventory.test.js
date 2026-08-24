import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import process from 'node:process';

describe('R6-NO-SKIP / TEST-INVENTORY', () => {
  it('falha antes do Vitest quando um arquivo obrigatório está ausente', () => {
    const result = spawnSync(process.execPath, ['scripts/assert-phase2-test-files.mjs'], {
      encoding: 'utf8',
      env: { ...process.env, PHASE2_REQUIRED_EXTRA: 'src/lib/__tests__/__missing_phase2_probe__.test.js' },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Missing phase 2 test files');
    expect(result.stderr).toContain('__missing_phase2_probe__');
  });

  it.each(['todo', 'skip'])('reprova teste marcado como %s', (marker) => {
    const directory = mkdtempSync(join(tmpdir(), 'phase2-gate-'));
    const fixture = join(directory, 'probe.test.js');
    writeFileSync(fixture, `it.${marker}('probe', () => {});`);
    const result = spawnSync(process.execPath, ['scripts/assert-phase2-test-files.mjs'], {
      encoding: 'utf8', env: { ...process.env, PHASE2_REQUIRED_EXTRA: fixture },
    });
    rmSync(directory, { recursive: true, force: true });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('todo/skip tests are forbidden');
  });

  it('ignora marcadores presentes apenas em comentários', () => {
    const directory = mkdtempSync(join(tmpdir(), 'phase2-comments-'));
    const fixture = join(directory, 'comment-only.test.js');
    writeFileSync(fixture, `// it.todo('comment')\n/* test.skip('comment') */\nit('active', () => {});`);
    const result = spawnSync(process.execPath, ['scripts/assert-phase2-test-files.mjs'], {
      encoding: 'utf8', env: { ...process.env, PHASE2_REQUIRED_EXTRA: fixture },
    });
    rmSync(directory, { recursive: true, force: true });
    expect(result.status).toBe(0);
  });
});