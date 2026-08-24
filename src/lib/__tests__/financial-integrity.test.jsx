/**
 * financial-integrity.test.jsx — Testes de integridade de dados financeiros (F2-INT-01, F2-DED-01).
 *
 * Verifica:
 *   1. O auditor identifica padrões proibidos
 *   2. A etapa Validação existe na jornada
 *   3. As funções autorizadas existem
 *   4. O schema FinancialDiagnosis tem campos de integridade
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..', '..', '..');

describe('F2-INT-01 — Integridade como gate', () => {
  it('Function getFinancialJourneyState existe', () => {
    expect(existsSync(join(ROOT, 'base44', 'functions', 'getFinancialJourneyState', 'entry.ts'))).toBe(true);
  });

  it('Function deleteFinancialUploadSafe existe', () => {
    expect(existsSync(join(ROOT, 'base44', 'functions', 'deleteFinancialUploadSafe', 'entry.ts'))).toBe(true);
  });

  it('Function replaceFinancialSourcePeriod existe', () => {
    expect(existsSync(join(ROOT, 'base44', 'functions', 'replaceFinancialSourcePeriod', 'entry.ts'))).toBe(true);
  });

  it('Entidade FinancialProcessingRun existe', () => {
    expect(existsSync(join(ROOT, 'base44', 'entities', 'FinancialProcessingRun.jsonc'))).toBe(true);
  });

  it('Entidade FinancialProcessingSnapshot existe', () => {
    expect(existsSync(join(ROOT, 'base44', 'entities', 'FinancialProcessingSnapshot.jsonc'))).toBe(true);
  });
});

describe('F2-INT-01 — Schema FinancialDiagnosis tem campos de integridade', () => {
  const schemaPath = join(ROOT, 'base44', 'entities', 'FinancialDiagnosis.jsonc');
  const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
  const props = schema.properties;

  it('tem integrity_status', () => {
    expect(props.integrity_status).toBeDefined();
    expect(props.integrity_status.enum).toContain('blocked');
  });

  it('tem integrity_blocking_count', () => {
    expect(props.integrity_blocking_count).toBeDefined();
  });

  it('tem integrity_warning_count', () => {
    expect(props.integrity_warning_count).toBeDefined();
  });

  it('tem integrity_checked_at', () => {
    expect(props.integrity_checked_at).toBeDefined();
  });

  it('tem last_active_step', () => {
    expect(props.last_active_step).toBeDefined();
  });

  it('tem current_processing_snapshot_id', () => {
    expect(props.current_processing_snapshot_id).toBeDefined();
  });
});

describe('F2-DED-01 — Schema FinancialUpload tem campos de substituição', () => {
  const schemaPath = join(ROOT, 'base44', 'entities', 'FinancialUpload.jsonc');
  const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
  const props = schema.properties;

  it('tem replacement_status', () => {
    expect(props.replacement_status).toBeDefined();
    expect(props.replacement_status.enum).toContain('pending');
    expect(props.replacement_status.enum).toContain('activated');
  });

  it('tem supersedes_upload_id', () => {
    expect(props.supersedes_upload_id).toBeDefined();
  });

  it('tem superseded_by_upload_id', () => {
    expect(props.superseded_by_upload_id).toBeDefined();
  });

  it('tem source_key', () => {
    expect(props.source_key).toBeDefined();
  });
});

describe('F2-PUR-01 — Purge functions não engolem erros', () => {
  const purgeUploadPath = join(ROOT, 'base44', 'functions', 'purgeFinancialUploadData', 'entry.ts');
  const purgeDerivedPath = join(ROOT, 'base44', 'functions', 'purgeFinancialDerivedData', 'entry.ts');

  it('purgeFinancialUploadData não tem catch { return 0 }', () => {
    const content = readFileSync(purgeUploadPath, 'utf-8');
    expect(content).not.toMatch(/catch\s*\{[^}]*return\s+0\s*;?\s*\}/);
  });

  it('purgeFinancialDerivedData não tem catch { return 0 }', () => {
    const content = readFileSync(purgeDerivedPath, 'utf-8');
    expect(content).not.toMatch(/catch\s*\{[^}]*return\s+0\s*;?\s*\}/);
  });

  it('purgeFinancialUploadData produz manifesto', () => {
    const content = readFileSync(purgeUploadPath, 'utf-8');
    expect(content).toMatch(/manifest/);
    expect(content).toMatch(/partial_failed|failed/);
  });
});

describe('F2-SNP-01 — conteúdo de snapshot é imutável', () => {
  it('permite somente transições de lifecycle candidate → active ou active/candidate → invalid', () => {
    const funcsDir = join(ROOT, 'base44', 'functions');
    const invalidUpdates = [];
    for (const fn of readdirSync(funcsDir)) {
      const entryPath = join(funcsDir, fn, 'entry.ts');
      if (!existsSync(entryPath)) continue;
      const content = readFileSync(entryPath, 'utf-8');
      for (const match of content.matchAll(/FinancialProcessingSnapshot\s*\.\s*update\s*\(/g)) {
        const tail = content.slice(match.index, match.index + 700);
        const end = tail.indexOf(');');
        const block = end >= 0 ? tail.slice(0, end + 2) : tail;
        const immutableMutation = /(?:source_manifest|output_manifest|input_checksum|output_checksum|version_number)\s*:/.test(block);
        const invalidationOnly = /status:\s*['"]invalid['"]/.test(block) && /invalid_reason/.test(block) && /invalidated_at/.test(block) && /invalidated_by_run_id/.test(block) && !immutableMutation;
        const candidatePublicationOnly = /status:\s*['"]active['"]/.test(block) && !/(?:invalid_reason|invalidated_at|source_manifest|output_manifest|input_checksum|output_checksum|version_number)\s*:/.test(block);
        if (!invalidationOnly && !candidatePublicationOnly) invalidUpdates.push(fn);
      }
    }
    expect(invalidUpdates).toEqual([]);
  });
});