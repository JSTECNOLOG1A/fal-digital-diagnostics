#!/usr/bin/env node
/**
 * Runner de validação completa — gera relatório JSON.
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const root = process.cwd();
const timeoutMs = Number(process.env.FULL_TEST_TIMEOUT_MS || 300000);

const SUITES = [
  { id: 'smoke-local', kind: 'node', command: 'node', args: ['scripts/smoke-local-offline.mjs'] },
  { id: 'audit-backend-compile', kind: 'npm', script: 'audit:backend-compile' },
  { id: 'audit-seg02', kind: 'npm', script: 'audit:seg02' },
  { id: 'audit-rbac-functions', kind: 'npm', script: 'audit:rbac-functions' },
  { id: 'audit-phase5-routes', kind: 'npm', script: 'audit:phase5-routes' },
  { id: 'audit-phase5-query-scope', kind: 'npm', script: 'audit:phase5-query-scope' },
  { id: 'audit-phase5-production-surface', kind: 'npm', script: 'audit:phase5-production-surface' },
  { id: 'audit-phase5-product-readiness', kind: 'npm', script: 'audit:phase5-product-readiness' },
  { id: 'test-phase2', kind: 'npm', script: 'test:phase2' },
  { id: 'test-phase3', kind: 'npm', script: 'test:phase3' },
  { id: 'test-phase4', kind: 'npm', script: 'test:phase4' },
  { id: 'test-phase5', kind: 'npm', script: 'test:phase5' },
  { id: 'test-rc1', kind: 'npm', script: 'test:rc1' },
  { id: 'lint', kind: 'npm', script: 'lint' },
  { id: 'typecheck', kind: 'npm', script: 'typecheck' },
];

function run(command, args) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, FORCE_COLOR: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (c) => {
      const t = c.toString();
      stdout += t;
      process.stdout.write(t);
    });
    child.stderr.on('data', (c) => {
      const t = c.toString();
      stderr += t;
      process.stderr.write(t);
    });

    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({
        exit_code: timedOut ? null : code ?? 1,
        timed_out: timedOut,
        duration_ms: Date.now() - started,
        stdout_tail: stdout.slice(-4000),
        stderr_tail: stderr.slice(-4000),
      });
    });
  });
}

function extractVitestCounts(text) {
  const m = text.match(/Tests?\s+(\d+)\s+failed.*?(\d+)\s+passed|Tests?\s+(\d+)\s+passed/i)
    || text.match(/(\d+) failed.*?(\d+) passed/)
    || text.match(/Test Files\s+(\d+) failed.*?(\d+) passed/)
    || text.match(/Test Files\s+(\d+) passed/);
  // Prefer Vitest summary line: "Tests  12 failed | 100 passed"
  const line = [...text.matchAll(/Tests\s+([^\n]+)/g)].pop()?.[1] || '';
  const failed = Number((line.match(/(\d+)\s+failed/) || [])[1] || 0);
  const passed = Number((line.match(/(\d+)\s+passed/) || [])[1] || 0);
  const skipped = Number((line.match(/(\d+)\s+skipped/) || [])[1] || 0);
  if (passed || failed || skipped) return { passed, failed, skipped };
  return null;
}

async function main() {
  const results = [];
  console.log(`\n=== Validação completa FAL (${SUITES.length} suítes) ===\n`);

  for (const suite of SUITES) {
    console.log(`\n>>> ${suite.id}`);
    const command = suite.kind === 'npm' ? npm : suite.command;
    const args = suite.kind === 'npm' ? ['run', suite.script] : suite.args;
    const result = await run(command, args);
    const combined = `${result.stdout_tail}\n${result.stderr_tail}`;
    const vitest = extractVitestCounts(combined);
    const ok = result.exit_code === 0 && !result.timed_out;
    results.push({
      id: suite.id,
      status: result.timed_out ? 'TIMEOUT' : ok ? 'PASS' : 'FAIL',
      exit_code: result.exit_code,
      duration_ms: result.duration_ms,
      vitest,
    });
    console.log(`<<< ${suite.id}: ${results.at(-1).status} (${result.duration_ms}ms)`);
  }

  const summary = {
    finished_at: new Date().toISOString(),
    mode: 'local-offline + unit/integration suites',
    total: results.length,
    passed: results.filter((r) => r.status === 'PASS').length,
    failed: results.filter((r) => r.status === 'FAIL').length,
    timeout: results.filter((r) => r.status === 'TIMEOUT').length,
    results,
  };

  const out = join(root, 'tmp-full-validation-report.json');
  writeFileSync(out, JSON.stringify(summary, null, 2));
  console.log(`\nRelatório: ${out}`);
  console.log(JSON.stringify({ total: summary.total, passed: summary.passed, failed: summary.failed, timeout: summary.timeout }, null, 2));
  process.exitCode = summary.failed + summary.timeout > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
