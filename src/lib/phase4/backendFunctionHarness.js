import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';

export { createInMemoryRepository } from './inMemoryBase44Repository.js';

export async function executeBackendFunction({ functionName, payload = {}, seed = {}, user = null, failurePlan = {}, invokePlan = {}, requestHeaders = {}, sharedExecutionContext = null, clock = null, uuidSequence = [] }) {
  const entryPath = resolve(`base44/functions/${functionName}/entry.ts`);
  const source = await readFile(entryPath, 'utf8');
  if (!source.includes('Deno.serve')) throw new Error(`Productive handler missing: ${functionName}`);
  const directory = await mkdtemp(join(tmpdir(), 'fal-phase4-harness-'));
  const inputPath = join(directory, 'input.json');
  const outputPath = join(directory, 'output.json');
  try {
    await writeFile(inputPath, JSON.stringify({ functionName, payload, seed: sharedExecutionContext?.state || seed, user: sharedExecutionContext?.user || user, failurePlan, invokePlan, requestHeaders, clock, uuidSequence }));
    execFileSync(process.execPath, ['src/lib/phase4/backendFunctionChildRunner.mjs', inputPath, outputPath], { stdio: 'pipe' });
    const result = JSON.parse(await readFile(outputPath, 'utf8'));
    return { ...result, response: { status: result.status, body: result.body } };
  } finally { await rm(directory, { recursive: true, force: true }); }
}