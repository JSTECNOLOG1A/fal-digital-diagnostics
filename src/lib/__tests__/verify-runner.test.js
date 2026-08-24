import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import process from 'node:process';

const run = (steps, timeout = 1000) => spawnSync(process.execPath, ['scripts/run-verify.mjs'], {
  encoding: 'utf8', timeout: timeout + 5000,
  env: { ...process.env, NODE_ENV: 'test', VERIFY_STEPS_JSON: JSON.stringify(steps), VERIFY_TIMEOUT_MS: String(timeout) },
});
const wait = (milliseconds) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);

describe('R8-VERIFY-RUNNER', () => {
  it('uses the physical Phase 4 test inventory instead of a literal wildcard', () => {
    const source = readFileSync('scripts/run-verify.mjs', 'utf8');
    expect(source).toContain('export const PHASE4_TEST_FILES');
    expect(source).toContain("...PHASE4_TEST_FILES");
    expect(source).not.toContain("'src/lib/__tests__/phase4-*.test.js'");
  });

  it('encerra com exit 0', () => {
    const result = run([[process.execPath, ['-e', 'process.exit(0)']]]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"verify_success":true');
  });

  it('encerra com exit 1', () => {
    const result = run([[process.execPath, ['-e', 'process.exit(1)']]]);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('"exit_code":1');
  });

  it('trata timeout do processo principal', () => {
    const result = run([[process.execPath, ['-e', 'setTimeout(() => {}, 10000)']]], 100);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('"timed_out":true');
    expect(result.stdout).toContain('"error":"STEP_TIMEOUT"');
  });

  it('elimina processo descendente no timeout', () => {
    const directory = mkdtempSync(join(tmpdir(), 'verify-tree-'));
    const marker = join(directory, 'orphan.txt');
    const grandchild = `setTimeout(() => require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'orphan'), 400)`;
    const parent = `const { spawn } = require('node:child_process'); spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { stdio: 'ignore' }); setTimeout(() => {}, 10000)`;
    const result = run([[process.execPath, ['-e', parent]]], 100);
    wait(600);
    expect(result.status).toBe(1);
    expect(existsSync(marker)).toBe(false);
    rmSync(directory, { recursive: true, force: true });
  });

  it('encerra quando descendente mantém stdout aberto', () => {
    const directory = mkdtempSync(join(tmpdir(), 'verify-stream-'));
    const marker = join(directory, 'stream-orphan.txt');
    const grandchild = `process.stdout.write('child-open\\n'); setTimeout(() => require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'orphan'), 5000)`;
    const parent = `const { spawn } = require('node:child_process'); spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { stdio: ['ignore', 'inherit', 'inherit'] }).unref(); process.stdout.write('parent-exit\\n')`;
    const result = run([[process.execPath, ['-e', parent]]], 1000);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('parent-exit');
    expect(existsSync(marker)).toBe(false);
    rmSync(directory, { recursive: true, force: true });
  });

  it('captura e encaminha stdout e stderr', () => {
    const command = `process.stdout.write('OUT-CAPTURED'); process.stderr.write('ERR-CAPTURED')`;
    const result = run([[process.execPath, ['-e', command]]]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('OUT-CAPTURED');
    expect(result.stderr).toContain('ERR-CAPTURED');
  });

  it('executa múltiplos steps em sequência', () => {
    const result = run([
      [process.execPath, ['-e', `process.stdout.write('STEP-ONE')`]],
      [process.execPath, ['-e', `process.stdout.write('STEP-TWO')`]],
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('STEP-ONE');
    expect(result.stdout).toContain('STEP-TWO');
    expect(result.stdout).toContain('"total_steps":2');
  });

  it('interrompe steps posteriores após falha', () => {
    const directory = mkdtempSync(join(tmpdir(), 'verify-stop-'));
    const marker = join(directory, 'should-not-exist.txt');
    const result = run([
      [process.execPath, ['-e', 'process.exit(1)']],
      [process.execPath, ['-e', `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'ran')`]],
    ]);
    expect(result.status).toBe(1);
    expect(existsSync(marker)).toBe(false);
    rmSync(directory, { recursive: true, force: true });
  });

  it('não deixa descendente após saída normal do processo principal', () => {
    const directory = mkdtempSync(join(tmpdir(), 'verify-exit-tree-'));
    const marker = join(directory, 'normal-orphan.txt');
    const grandchild = `setTimeout(() => require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'orphan'), 500)`;
    const parent = `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { stdio: 'ignore' }).unref()`;
    const result = run([[process.execPath, ['-e', parent]]]);
    wait(700);
    expect(result.status).toBe(0);
    expect(existsSync(marker)).toBe(false);
    rmSync(directory, { recursive: true, force: true });
  });
});