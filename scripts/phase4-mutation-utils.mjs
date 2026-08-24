import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join, relative } from 'node:path';

const ignored = new Set(['.git', 'node_modules', 'dist', 'audit-artifacts']);

export function computeTreeSha(root) {
  const files = [];
  const walk = (folder) => readdirSync(folder).sort().forEach((name) => {
    if (ignored.has(name)) return;
    const path = join(folder, name);
    if (statSync(path).isDirectory()) walk(path); else files.push(path);
  });
  walk(root);
  const hash = createHash('sha256');
  files.forEach((file) => { hash.update(relative(root, file).replaceAll('\\', '/')); hash.update('\0'); hash.update(readFileSync(file)); hash.update('\0'); });
  return hash.digest('hex');
}

export function copyProductTree({ source, target }) {
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true, filter: (path) => !ignored.has(path.split('/').pop()) });
}

export function replaceExactly({ file, from, to, expectedCount = 1 }) {
  const source = readFileSync(file, 'utf8');
  if (source.includes(to)) throw new Error(`MUTATION_TARGET_ALREADY_PRESENT:${file}`);
  const count = source.split(from).length - 1;
  if (count !== expectedCount) throw new Error(`MUTATION_TARGET_COUNT:${file}:expected=${expectedCount}:actual=${count}`);
  writeFileSync(file, source.replace(from, to));
  return { count };
}

export function runCommand({ cwd, command, args = [], timeoutMs }) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(command, args, { cwd, shell: false, detached: process.platform !== 'win32' });
    let stdout = ''; let stderr = ''; let timedOut = false;
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    child.once('close', (exitCode) => { clearTimeout(timer); resolve({ exitCode: exitCode ?? 1, stdout, stderr, durationMs: Date.now() - started, timedOut }); });
    child.once('error', (error) => { clearTimeout(timer); resolve({ exitCode: 1, stdout, stderr: `${stderr}\n${error.message}`, durationMs: Date.now() - started, timedOut }); });
  });
}

export function persistOutput({ root, mutationId, label, output }) {
  const folder = join(root, 'src/docs/audit-artifacts/phase4-mutations-v254');
  mkdirSync(folder, { recursive: true });
  const base = `${mutationId.toLowerCase()}-${label}`;
  const stdoutFile = join(folder, `${base}.stdout.log`);
  const stderrFile = join(folder, `${base}.stderr.log`);
  writeFileSync(stdoutFile, output.stdout || '');
  writeFileSync(stderrFile, output.stderr || '');
  return { stdoutFile: relative(root, stdoutFile), stderrFile: relative(root, stderrFile) };
}

export function removeTree(path) { if (existsSync(path)) rmSync(path, { recursive: true, force: true }); }