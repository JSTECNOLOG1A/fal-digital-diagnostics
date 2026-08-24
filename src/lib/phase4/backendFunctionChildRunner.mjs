import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { createDeterministicRuntime } from './deterministicRuntime.js';
import { createFailureController } from './failurePlan.js';
import { createInMemoryRepository } from './inMemoryBase44Repository.js';

const [inputPath, outputPath] = process.argv.slice(2);
const input = JSON.parse(await readFile(inputPath, 'utf8'));
const controller = createFailureController(input.failurePlan);
const repository = createInMemoryRepository(input.seed, controller);
const runtime = createDeterministicRuntime({ ...input, nativeRandomUUID: globalThis.crypto?.randomUUID?.bind(globalThis.crypto) });
const functionCalls = [];
const authCalls = [];
const responses = [];
const executionId = `phase4-${Date.now()}`;
const previousDeno = globalThis.Deno;
const NativeDate = globalThis.Date;
const nativeCrypto = globalThis.crypto;
const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

class ScenarioDate extends NativeDate {
  constructor(...args) { super(...(args.length ? args : [runtime.now().toISOString()])); }
  static now() { return runtime.now().getTime(); }
}

globalThis.Date = ScenarioDate;
Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { subtle: nativeCrypto?.subtle, getRandomValues: nativeCrypto?.getRandomValues?.bind(nativeCrypto), randomUUID: runtime.randomUUID } });

async function runHandler(functionName, payload) {
  const entryPath = resolve(`base44/functions/${functionName}/entry.ts`);
  const source = await readFile(entryPath, 'utf8');
  if (!source.includes('Deno.serve')) throw new Error(`Handler missing from productive source: ${functionName}`);
  const injected = source.replace(/import\s*\{\s*createClientFromRequest\s*\}\s*from\s*['"]npm:@base44\/sdk@[^'"]+['"];?/, 'const { createClientFromRequest } = globalThis.__phase4SdkFactory;');
  if (injected === source) throw new Error(`SDK import was not injected: ${functionName}`);
  const directory = await mkdtemp(join(tmpdir(), 'fal-phase4-child-'));
  const sourcePath = join(directory, `${functionName}.ts`);
  const modulePath = join(directory, `${functionName}.mjs`);
  let handler;
  globalThis.Deno = { serve: (registered) => { handler = registered; } };
  try {
    await writeFile(sourcePath, injected);
    const transformed = execFileSync('node_modules/esbuild/bin/esbuild', [sourcePath, '--bundle', '--format=esm', '--platform=node', '--target=es2022'], { encoding: 'utf8' });
    await writeFile(modulePath, transformed);
    await import(`${pathToFileURL(modulePath).href}?t=${NativeDate.now()}-${functionCalls.length}`);
    if (typeof handler !== 'function') throw new Error(`Handler was not captured: ${functionName}`);
    const response = await handler(new Request(`https://phase4.test/${functionName}`, { method: 'POST', headers: { 'content-type': 'application/json', ...input.requestHeaders }, body: JSON.stringify(payload) }));
    return { status: response.status, body: await response.json(), productiveSourcePath: entryPath };
  } finally { await rm(directory, { recursive: true, force: true }); }
}

async function invoke(functionName, payload) {
  controller.check(`functions.invoke:${functionName}`, 'before', repository.state);
  functionCalls.push({ functionName, payload });
  try {
    const nested = await runHandler(functionName, payload);
    if (nested.status >= 400) throw new Error(`FUNCTION_INVOKE_FAILED:${nested.status}:${JSON.stringify(nested.body)}`);
    controller.check(`functions.invoke:${functionName}`, 'after', repository.state);
    return { data: nested.body, status: nested.status };
  } catch (error) { throw error; }
}

globalThis.__phase4SdkFactory = { createClientFromRequest: () => ({
  auth: { me: async () => { authCalls.push({ method: 'me' }); return input.user; } },
  asServiceRole: { entities: repository.entities, functions: { invoke } },
  entities: repository.entities,
  functions: { invoke },
}) };

try {
  const steps = input.steps?.length ? input.steps : [{ id: 'single', functionName: input.functionName, payload: input.payload }];
  for (const step of steps) {
    const result = await runHandler(step.functionName, step.payload);
    responses.push({ id: step.id, functionName: step.functionName, response: result });
  }
  const last = responses.at(-1)?.response || { status: 500, body: { error: 'NO_SCENARIO_STEPS' } };
  await writeFile(outputPath, JSON.stringify({ ...last, state: repository.state, mutations: repository.mutations, entityCalls: repository.entityCalls, functionCalls, authCalls, executionId, failures: controller.failures, clockCalls: runtime.clockCalls, uuidCalls: runtime.uuidCalls, responses }));
} finally {
  globalThis.Deno = previousDeno;
  globalThis.Date = NativeDate;
  Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);
}