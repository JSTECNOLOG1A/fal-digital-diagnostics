import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

export async function executeBackendScenario({ seed = {}, user = null, steps = [], now, clockSequence, uuidSequence, failurePlan = {}, invokePlan = {} }) {
  const directory = await mkdtemp(join(tmpdir(), 'fal-phase4-scenario-'));
  const inputPath = join(directory, 'input.json');
  const outputPath = join(directory, 'output.json');
  try {
    await writeFile(inputPath, JSON.stringify({ seed, user, steps, now, clockSequence, uuidSequence, failurePlan, invokePlan, scenario: true }));
    execFileSync(process.execPath, ['src/lib/phase4/backendFunctionChildRunner.mjs', inputPath, outputPath], { stdio: 'pipe' });
    return JSON.parse(await readFile(outputPath, 'utf8'));
  } finally { await rm(directory, { recursive: true, force: true }); }
}

export async function createBackendScenario(options) {
  const steps = [];
  let snapshot = null;
  return {
    async invoke(functionName, payload) {
      steps.push({ id: `step-${steps.length + 1}`, functionName, payload });
      snapshot = await executeBackendScenario({ ...options, steps });
      return snapshot.responses.at(-1);
    },
    snapshot: () => snapshot || { state: structuredClone(options.seed || {}), mutations: [], entityCalls: [], functionCalls: [], authCalls: [], failures: [], clockCalls: [], uuidCalls: [], responses: [] },
  };
}