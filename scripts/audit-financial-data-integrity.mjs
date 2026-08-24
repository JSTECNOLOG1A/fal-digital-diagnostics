#!/usr/bin/env node
/**
 * audit-financial-data-integrity.mjs — Auditor da FASE 2 RESIDUAL 7.
 *
 * Verifica padrões proibidos e obrigatórios no código frontend e backend:
 *   1. FinancialUpload.delete( direto (deve usar deleteFinancialUploadSafe)
 *   2. purgeFinancialUploadData chamado do fluxo de substituição
 *   3. Override "processed → all steps true" no journey
 *   4. Ausência da etapa Validação na jornada
 *   5. FinancialProcessingSnapshot.update( (snapshot imutável) — em qualquer function
 *   6. FinancialDiagnosis.update para status draft no frontend
 *   7. (R2) snapshot function sem write guard
 *   8. (R2) snapshot function sem reuse por processing run
 *   9. (R2) build/validate/prepare/finalize sem ProcessingRun
 *   10. (R2) candidate mode não lido no integrity check
 *   11. (R2) integrity check com catch → [] em fonte crítica
 *   12. (R2) input_checksum apenas metadata do navegador
 *   13. (R2) financial-processing.test ausente
 *   14. (R2) getFinancialJourneyState atualiza FinancialDiagnosis
 *   15. (R2) client_viewer pode executar mutation produtiva
 *
 * Exit 1 se qualquer violação for encontrada.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, extname, relative } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const BASE44_FUNCS = join(ROOT, 'base44', 'functions');

const violations = [];
const warnings = [];

function walkDir(dir, exts, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules' || entry === '.git') continue;
      walkDir(full, exts, files);
    } else if (exts.includes(extname(full))) {
      files.push(full);
    }
  }
  return files;
}

function readFile(path) {
  try { return readFileSync(path, 'utf-8'); } catch { return ''; }
}

const jsxFiles = walkDir(SRC, ['.jsx', '.js']);
const tsFiles = walkDir(BASE44_FUNCS, ['.ts']);

// ── 1. No direct FinancialUpload.delete in frontend productive code ──
for (const file of jsxFiles) {
  const content = readFile(file);
  const rel = relative(ROOT, file);
  if (rel.includes('__tests__') || rel.includes('.test.') || rel.includes('.spec.')) continue;

  if (/FinancialUpload\s*\.\s*delete\s*\(/.test(content) && !rel.includes('deleteFinancialUploadSafe')) {
    violations.push({
      check: 'F2-DEL-01',
      file: rel,
      message: 'Chamada direta FinancialUpload.delete() — deve usar deleteFinancialUploadSafe',
    });
  }

  if (/purgeFinancialUploadData/.test(content) && /handleReplaceConfirm|substituir.*per[ií]odo|replaceFinancialSourcePeriod/.test(content)) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (/purgeFinancialUploadData/.test(lines[i]) && i > 0) {
        let context = '';
        for (let j = Math.max(0, i - 15); j < i; j++) context += lines[j] + '\n';
        if (/handleReplace|substituir|Replace/.test(context) && !/replaceFinancialSourcePeriod/.test(context)) {
          violations.push({
            check: 'F2-PER-01',
            file: rel,
            line: i + 1,
            message: 'purgeFinancialUploadData (nuclear) chamado do fluxo de substituição — deve usar replaceFinancialSourcePeriod',
          });
        }
      }
    }
  }
}

// ── 2. No "processed → all steps true" override in useDiagnosisJourney ──
const journeyFile = join(SRC, 'lib', 'hooks', 'useDiagnosisJourney.js');
const journeyContent = readFile(journeyFile);
if (journeyContent) {
  if (/isProcessedDiagnosis/.test(journeyContent) && /Object\.fromEntries.*Object\.keys.*conditions.*true/.test(journeyContent)) {
    violations.push({
      check: 'F2-JRN-01',
      file: 'src/lib/hooks/useDiagnosisJourney.js',
      message: 'Override "processed → all steps true" ainda presente — mascara inconsistências',
    });
  }
  if (!/validacao/.test(journeyContent) && !/getFinancialJourneyState/.test(journeyContent)) {
    warnings.push({
      check: 'F2-JRN-01',
      file: 'src/lib/hooks/useDiagnosisJourney.js',
      message: 'Etapa Validação não encontrada na jornada',
    });
  }
}

// ── Snapshot content is immutable; regex remains global and only lifecycle invalidation is accepted. ──
for (const file of tsFiles) {
  const content = readFile(file);
  const rel = relative(ROOT, file);
  for (const match of content.matchAll(/FinancialProcessingSnapshot\s*\.\s*update\s*\(/g)) {
    const tail = content.slice(match.index, match.index + 700);
    const end = tail.indexOf(');');
    const block = end >= 0 ? tail.slice(0, end + 2) : tail;
    const immutableMutation = /(?:source_manifest|output_manifest|input_checksum|output_checksum|version_number)\s*:/.test(block);
    const invalidationOnly = /status:\s*['"]invalid['"]/.test(block) && /invalid_reason/.test(block) && /invalidated_at/.test(block) && /invalidated_by_run_id/.test(block) && !immutableMutation;
    const candidatePublicationOnly = /status:\s*['"]active['"]/.test(block) && !/(?:invalid_reason|invalidated_at|source_manifest|output_manifest|input_checksum|output_checksum|version_number)\s*:/.test(block);
    if (!invalidationOnly && !candidatePublicationOnly) violations.push({ check: 'F2-SNP-01', file: rel, message: 'Snapshot content update proibido; somente lifecycle candidate→active ou active/candidate→invalid é permitido' });
  }
}

// ── 4. No direct FinancialDiagnosis.update for destructive status manipulation in frontend ──
for (const file of jsxFiles) {
  const content = readFile(file);
  const rel = relative(ROOT, file);
  if (rel.includes('__tests__') || rel.includes('.test.') || rel.includes('.spec.')) continue;

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/FinancialDiagnosis\s*\.\s*update\s*\(/.test(lines[i])) {
      let context = '';
      for (let j = i; j < Math.min(lines.length, i + 5); j++) context += lines[j] + '\n';
      if (/status:\s*['"]draft['"]/.test(context)) {
        violations.push({
          check: 'F2-PUR-01',
          file: rel,
          line: i + 1,
          message: 'FinancialDiagnosis.update({ status: "draft" }) no frontend — deve usar função de purge autorizada',
        });
      }
    }
  }
}

// ── 5. Check that authorized functions exist ──
const safeDeleteFn = join(BASE44_FUNCS, 'deleteFinancialUploadSafe', 'entry.ts');
const replaceFn = join(BASE44_FUNCS, 'replaceFinancialSourcePeriod', 'entry.ts');
const journeyFn = join(BASE44_FUNCS, 'getFinancialJourneyState', 'entry.ts');
for (const [fn, id] of [[safeDeleteFn, 'F2-DEL-01'], [replaceFn, 'F2-PER-01'], [journeyFn, 'F2-JRN-01']]) {
  if (!existsSync(fn)) {
    violations.push({
      check: id,
      file: relative(ROOT, fn),
      message: 'Function autorizada não encontrada',
    });
  }
}

// ── 6. Purge functions don't swallow errors ──
for (const fn of ['purgeFinancialUploadData', 'purgeFinancialDerivedData']) {
  const path = join(BASE44_FUNCS, fn, 'entry.ts');
  const content = readFile(path);
  if (content && /catch\s*\{[^}]*return\s+0\s*;?\s*\}/.test(content)) {
    violations.push({
      check: 'F2-PUR-01',
      file: `base44/functions/${fn}/entry.ts`,
      message: 'Purge engole erro (catch { return 0 }) — deve reportar falha no manifesto',
    });
  }
}

// ═════════════════════════════════════════════════════════════════════
// RESIDUAL 2 — Novas verificações
// ═════════════════════════════════════════════════════════════════════

// ── 7 (R2). Snapshot function must have write guard ──
const snapshotFnPath = join(BASE44_FUNCS, 'createFinancialProcessingSnapshot', 'entry.ts');
const snapshotContent = readFile(snapshotFnPath);
if (snapshotContent) {
  if (!/WRITE_ROLES\s*=\s*new Set\(/.test(snapshotContent)) {
    violations.push({
      check: 'F2-SNP-01',
      file: 'base44/functions/createFinancialProcessingSnapshot/entry.ts',
      message: 'Snapshot function sem write-role guard (WRITE_ROLES)',
    });
  }
  // 8 (R2). Snapshot function must have reuse by processing run
  if (!/existingForRun/.test(snapshotContent) && !/financial_processing_run_id/.test(snapshotContent)) {
    violations.push({
      check: 'F2-SNP-01',
      file: 'base44/functions/createFinancialProcessingSnapshot/entry.ts',
      message: 'Snapshot function sem reuse por processing run',
    });
  }
}

// ── 9 (R2). build/validate/prepare/finalize must use ProcessingRun ──
const processingFns = [
  'validateFinancialUpload', 'buildFinancialStatements',
  'prepareFinancialAnalysisDataset', 'finalizeFinancialInsights',
];
for (const fn of processingFns) {
  const path = join(BASE44_FUNCS, fn, 'entry.ts');
  const content = readFile(path);
  if (content && !/FinancialProcessingRun/.test(content)) {
    violations.push({
      check: 'F2-UPL-01',
      file: `base44/functions/${fn}/entry.ts`,
      message: 'Function de processamento não utiliza FinancialProcessingRun (idempotência)',
    });
  }
}

// ── 10 (R2). Integrity check must read mode parameter ──
const integrityFnPath = join(BASE44_FUNCS, 'checkFinancialDiagnosisIntegrity', 'entry.ts');
const integrityContent = readFile(integrityFnPath);
if (integrityContent) {
  if (!/mode\s*=\s*['"]full['"]/.test(integrityContent) || !/replacement_candidate/.test(integrityContent)) {
    violations.push({
      check: 'F2-INT-01',
      file: 'base44/functions/checkFinancialDiagnosisIntegrity/entry.ts',
      message: 'Integrity check não lê mode parameter (full | replacement_candidate)',
    });
  }
  // 11 (R2). Integrity check must NOT have catch → [] in critical source
  if (!/CRITICAL_ENTITIES/.test(integrityContent) || !/INTEGRITY_SOURCE_UNAVAILABLE/.test(integrityContent)) {
    violations.push({
      check: 'F2-INT-01',
      file: 'base44/functions/checkFinancialDiagnosisIntegrity/entry.ts',
      message: 'Integrity check sem fail-closed (CRITICAL_ENTITIES / INTEGRITY_SOURCE_UNAVAILABLE)',
    });
  }
}

// ── 12 (R2). input_checksum must not be only browser metadata ──
// Check that upload functions compute checksum in backend, not just from frontend
const validateFnPath = join(BASE44_FUNCS, 'validateFinancialUpload', 'entry.ts');
const validateContent = readFile(validateFnPath);
if (validateContent) {
  // Flag if input_checksum is only set from file metadata (name|size|lastModified)
  if (/input_checksum.*name.*size.*lastModified|input_checksum.*file\.name.*file\.size/.test(validateContent)) {
    violations.push({
      check: 'F2-DED-01',
      file: 'base44/functions/validateFinancialUpload/entry.ts',
      message: 'input_checksum é apenas metadata do navegador — deve ser hash determinístico do conteúdo',
    });
  }
}

// ── 13 (R2). financial-processing.test must exist ──
const testPath = join(SRC, 'lib', '__tests__', 'financial-processing.test.jsx');
if (!existsSync(testPath)) {
  violations.push({
    check: 'F2-TEST',
    file: 'src/lib/__tests__/financial-processing.test.jsx',
    message: 'Arquivo de teste financial-processing.test.jsx ausente',
  });
}

// ── 14 (R2). getFinancialJourneyState must NOT update FinancialDiagnosis ──
const journeyStatePath = join(BASE44_FUNCS, 'getFinancialJourneyState', 'entry.ts');
const journeyStateContent = readFile(journeyStatePath);
if (journeyStateContent) {
  if (/FinancialDiagnosis\s*\.\s*update\s*\(/.test(journeyStateContent)) {
    violations.push({
      check: 'F2-JRN-01',
      file: 'base44/functions/getFinancialJourneyState/entry.ts',
      message: 'getFinancialJourneyState atualiza FinancialDiagnosis — deve ser somente leitura',
    });
  }
}

// ── 15 (R2). client_viewer must not execute productive mutation ──
// Check that mutation functions have write-role guards
const mutationFns = [
  'createFinancialProcessingSnapshot', 'replaceFinancialSourcePeriod',
  'deleteFinancialUploadSafe',
];
for (const fn of mutationFns) {
  const path = join(BASE44_FUNCS, fn, 'entry.ts');
  const content = readFile(path);
  if (content) {
    if (!/WRITE_ROLES|ALLOWED_DELETE_ROLES/.test(content)) {
      violations.push({
        check: 'F2-RBAC',
        file: `base44/functions/${fn}/entry.ts`,
        message: 'Function de mutação sem write-role guard — client_viewer pode executar',
      });
    }
  }
}

// ── R6-DEL-RECOVERY / RUN-STATE / IDEMPOTENCY ──
const deleteFlow = readFile(safeDeleteFn);
if (/FinancialUpload\s*\.\s*delete\s*\(/.test(deleteFlow)) violations.push({ check: 'R6-DEL-RECOVERY', file: 'base44/functions/deleteFinancialUploadSafe/entry.ts', message: 'Fluxo principal executa exclusão física de FinancialUpload' });
for (const required of ['FinancialDeletionRecoveryManifest', 'manifest_checksum', 'RECOVERY_POSTCONDITION_FAILED', 'recovery_verified', "status: 'committing'", "concurrency_guarantee", 'PROCESSING_RUN_LOOKUP_UNAVAILABLE']) {
  if (!deleteFlow.includes(required)) violations.push({ check: 'R6-DEL-RECOVERY', file: 'base44/functions/deleteFinancialUploadSafe/entry.ts', message: `Contrato ausente: ${required}` });
}
const succeededAt = deleteFlow.indexOf("await repository.updateRun(run.id, { status: 'succeeded'");
const tombstoneAt = deleteFlow.indexOf("await repository.updateUpload(uploadId, { deletion_status: 'tombstoned'");
const committedManifestAt = deleteFlow.indexOf("await repository.updateRecoveryManifest(manifest.id, { status: 'committed' }");
if (succeededAt < 0 || tombstoneAt < 0 || committedManifestAt < 0 || succeededAt < tombstoneAt || succeededAt < committedManifestAt) violations.push({ check: 'R8-RUN-STATE', file: 'base44/functions/deleteFinancialUploadSafe/entry.ts', message: 'Run succeeded aparece antes do tombstone e do manifest committed' });
if (/erro ao checar runs existentes|PROCESSING_RUN_LOOKUP_UNAVAILABLE[\s\S]{0,200}console\.warn/.test(deleteFlow)) violations.push({ check: 'R6-IDEMPOTENCY', file: 'base44/functions/deleteFinancialUploadSafe/entry.ts', message: 'Lookup de run não é fail-closed' });
for (const file of tsFiles) {
  const content = readFile(file);
  const rel = relative(ROOT, file);
  const lookups = [...content.matchAll(/FinancialProcessingRun\.filter\s*\(/g)];
  for (const lookup of lookups) {
    const tail = content.slice(lookup.index, lookup.index + 1200);
    if (/catch[\s\S]{0,300}console\.warn/.test(tail) && /FinancialProcessingRun\.create/.test(tail)) violations.push({ check: 'R6-IDEMPOTENCY', file: rel, message: 'catch+warn+continue após lookup de processing run' });
  }
}

// ── R7: equivalência produtiva, replacement e lifecycle de snapshot ──
const canonicalDeleteSource = readFile(join(SRC, 'lib', 'financial', 'deleteFinancialUploadWorkflow.js')).replace(/^export /gm, '').trim();
const generatedDeleteSource = deleteFlow.match(/\/\/ <generated-delete-workflow>\n([\s\S]*?)\n\/\/ <\/generated-delete-workflow>/)?.[1]?.trim();
const declaredDeleteHash = deleteFlow.match(/generated-source-sha256:\s*([a-f0-9]{64})/)?.[1];
const canonicalDeleteHash = createHash('sha256').update(canonicalDeleteSource).digest('hex');
if (!generatedDeleteSource || generatedDeleteSource !== canonicalDeleteSource || declaredDeleteHash !== canonicalDeleteHash) violations.push({ check: 'R7-PRODUCTIVE-WORKFLOW', file: 'base44/functions/deleteFinancialUploadSafe/entry.ts', message: 'Orquestração produtiva diverge da fonte canônica/hash' });
const replaceFlow = readFile(replaceFn);
for (const required of ['PROCESSING_RUN_LOOKUP_UNAVAILABLE', "['running', 'committing', 'succeeded']", "status: 'committing'", 'FULL_INTEGRITY_EMPTY_RESPONSE', 'FULL_INTEGRITY_NOT_HEALTHY', 'FULL_INTEGRITY_BLOCKED', 'OPERATION_ROLLED_BACK', 'REPLACEMENT_COMMIT_POSTCONDITION_FAILED']) {
  if (!replaceFlow.includes(required)) violations.push({ check: 'R7-REPLACE', file: 'base44/functions/replaceFinancialSourcePeriod/entry.ts', message: `Contrato ausente: ${required}` });
}
const replaceSnapshotAt = replaceFlow.indexOf("base44.functions.invoke('createFinancialProcessingSnapshot'");
const replaceSucceededAt = replaceFlow.indexOf("status: 'succeeded'", replaceSnapshotAt);
if (replaceSnapshotAt < 0 || replaceSucceededAt < replaceSnapshotAt) violations.push({ check: 'R7-REPLACE-COMMIT', file: 'base44/functions/replaceFinancialSourcePeriod/entry.ts', message: 'succeeded publicado antes do snapshot' });
if (/let\s+integrityOk\s*=\s*true/.test(replaceFlow)) violations.push({ check: 'R7-INTEGRITY-RESPONSE', file: 'base44/functions/replaceFinancialSourcePeriod/entry.ts', message: 'Integridade começa permissiva' });
for (const required of ['current_processing_snapshot_id', 'PREVIOUS_SNAPSHOT_NOT_ACTIVE', "previousSnapshot.status !== 'active'"]) {
  if (!snapshotContent.includes(required)) violations.push({ check: 'R7-SNAPSHOT-ROLLBACK', file: 'base44/functions/createFinancialProcessingSnapshot/entry.ts', message: `Contrato ausente: ${required}` });
}

// ── Report ──
console.log('\n═══════════════════════════════════════════════════════');
console.log('  AUDITOR DE INTEGRIDADE DE DADOS FINANCEIROS — FASE 2 RESIDUAL 7');
console.log('═══════════════════════════════════════════════════════\n');

if (warnings.length > 0) {
  console.log('⚠️  WARNINGS:');
  for (const w of warnings) {
    console.log(`   [${w.check}] ${w.file}: ${w.message}`);
  }
  console.log('');
}

if (violations.length === 0) {
  console.log('✅ Nenhuma violação encontrada. Auditor PASS.\n');
  process.exit(0);
} else {
  console.log('❌ VIOLAÇÕES ENCONTRADAS:');
  for (const v of violations) {
    console.log(`   [${v.check}] ${v.file}${v.line ? `:${v.line}` : ''}: ${v.message}`);
  }
  console.log(`\n   Total: ${violations.length} violação(ões)\n`);
  process.exit(1);
}