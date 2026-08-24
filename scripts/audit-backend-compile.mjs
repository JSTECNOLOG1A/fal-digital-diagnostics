#!/usr/bin/env node
/**
 * audit-backend-compile.mjs
 * =====================================================================
 * Gate de compilação sintática para todas as functions backend.
 * Usa esbuild.transform para validar que todos os entry.ts compilam.
 *
 * Critério: 107 functions encontradas, 107 compiladas, 0 parse failures.
 */
import { transform } from 'esbuild';
import {
  existsSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { join } from 'node:path';

const root = join(
  process.cwd(),
  'base44',
  'functions'
);

const failures = [];
let total = 0;

for (const functionName of readdirSync(root)) {
  const file = join(
    root,
    functionName,
    'entry.ts'
  );

  if (!existsSync(file)) continue;

  total += 1;

  try {
    await transform(
      readFileSync(file, 'utf8'),
      {
        loader: 'ts',
        format: 'esm',
        target: 'es2022',
      }
    );
  } catch (error) {
    failures.push({
      function_name: functionName,
      errors:
        error.errors?.map((item) => ({
          line: item.location?.line,
          column: item.location?.column,
          message: item.text,
        })) || [
          {
            message: error.message,
          },
        ],
    });
  }
}

console.log(
  JSON.stringify(
    {
      total,
      passed: total - failures.length,
      failed: failures.length,
      failures,
    },
    null,
    2
  )
);

process.exit(failures.length ? 1 : 0);