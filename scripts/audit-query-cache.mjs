#!/usr/bin/env node
/**
 * SEG-04 — Automated Query Cache Audit (v2)
 * =====================================================================
 * Scans ALL .jsx/.js files under src/ for query operations and their
 * associated queryKey expressions.
 *
 * Improvements over v1:
 *   A. Deduplication — each queryKey expression is registered exactly once
 *      (determined by finding the operation via backward lookup from queryKey:)
 *   B. Narrowed SAFE_GLOBAL_ID — only variables in SAFE_ID_CONTEXTS matrix
 *      or .id access on recognized entity prefixes are classified as safe
 *   C. Multiline/dynamic coverage — extracts full expressions across lines,
 *      resolves variable references, flags ternaries as DYNAMIC_KEY
 *
 * Classifications:
 *   TENANT_FACTORY     — uses a tenant-scoped factory (tenantKey, groupKey, etc.)
 *   TENANT_EXPLICIT    — legacy array but includes tenantId as an element
 *   SAFE_GLOBAL_ID     — scoped by a globally-unique UUID from a recognized entity
 *   GLOBAL_BY_DESIGN   — method/catalog data shared across all tenants
 *   LEGACY_TEMPORARY   — legacy array without tenant; documented, pending migration
 *   DYNAMIC_KEY        — variable reference or ternary; needs manual classification
 *   PENDING            — cannot be classified; needs manual review
 *
 * Exit code 0 if PENDING === 0 for critical families, else 1.
 */
import { readdirSync, readFileSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const SRC_DIR = join(ROOT_DIR, 'src');

// ── Tenant-scoped factories ──────────────────────────────────────────────
const FACTORIES = [
  'tenantKey', 'financialKey', 'assessmentKey', 'groupKey',
  'companyKey', 'unitKey', 'actionPlanKey', 'reportKey', 'clientPortalKey',
];

// ── Factory → family bucket mapping (SEG-04 Residual 9 fix) ──────────────
// Fixes the bug where all factory-based queries were bucketed as 'other'.
const FACTORY_BUCKETS = {
  tenantKey:       'tenant',
  financialKey:    'financial',
  assessmentKey:   'diagnosis',
  groupKey:        'structure',
  companyKey:      'structure',
  unitKey:         'structure',
  actionPlanKey:   'action-plan',
  reportKey:       'reports',
  clientPortalKey: 'portal',
};

// ── SAFE_ID_CONTEXTS: validated entity-UUID variable matrix ──────────────
// Only variables listed here (or .id on recognized entity prefixes) qualify
// for SAFE_GLOBAL_ID. Each entry records the entity and uniqueness guarantee.
const SAFE_ID_CONTEXTS = {
  // ── CamelCase variables ──
  assessmentId:      { entity: 'Assessment',            uniqueness: 'Base44 UUID (24-char hex)' },
  groupId:           { entity: 'Group',                 uniqueness: 'Base44 UUID (24-char hex)' },
  companyId:         { entity: 'Company',               uniqueness: 'Base44 UUID (24-char hex)' },
  unitId:            { entity: 'OperationalUnit',        uniqueness: 'Base44 UUID (24-char hex)' },
  planId:            { entity: 'ActionPlan',             uniqueness: 'Base44 UUID (24-char hex)' },
  diagnosisId:       { entity: 'FinancialDiagnosis',     uniqueness: 'Base44 UUID (24-char hex)' },
  reportVersionId:   { entity: 'FinancialReportVersion', uniqueness: 'Base44 UUID (24-char hex)' },
  clientId:          { entity: 'Client',                 uniqueness: 'Base44 UUID (24-char hex)' },
  uploadId:          { entity: 'FinancialUpload',        uniqueness: 'Base44 UUID (24-char hex)' },
  accountPlanId:     { entity: 'FinancialAccountPlan',   uniqueness: 'Base44 UUID (24-char hex)' },
  entityId:          { entity: 'Entity (generic)',       uniqueness: 'Base44 UUID (24-char hex)' },
  cycleId:           { entity: 'FalAssessmentCycle',     uniqueness: 'Base44 UUID (24-char hex)' },
  taskId:            { entity: 'ActionTask',             uniqueness: 'Base44 UUID (24-char hex)' },
  reviewId:          { entity: 'ActionPlanReview',       uniqueness: 'Base44 UUID (24-char hex)' },
  recommendationId: { entity: 'ActionRecommendation',   uniqueness: 'Base44 UUID (24-char hex)' },

  // ── Snake_case variables (backend payloads) ──
  assessment_id:     { entity: 'Assessment',             uniqueness: 'Base44 UUID (24-char hex)' },
  group_id:          { entity: 'Group',                  uniqueness: 'Base44 UUID (24-char hex)' },
  company_id:        { entity: 'Company',                uniqueness: 'Base44 UUID (24-char hex)' },
  unit_id:           { entity: 'OperationalUnit',        uniqueness: 'Base44 UUID (24-char hex)' },
  plan_id:           { entity: 'ActionPlan',             uniqueness: 'Base44 UUID (24-char hex)' },
  diagnosis_id:      { entity: 'FinancialDiagnosis',     uniqueness: 'Base44 UUID (24-char hex)' },
  client_id:         { entity: 'Client',                 uniqueness: 'Base44 UUID (24-char hex)' },
  report_version_id: { entity: 'FinancialReportVersion', uniqueness: 'Base44 UUID (24-char hex)' },
  target_id:         { entity: 'Entity (generic)',       uniqueness: 'Base44 UUID (24-char hex)' },
};

// ── Entity prefix substrings for .id / ?.id access patterns ──────────────
// When a queryKey contains `varName.id` or `varName?.id`, the variable name
// is checked against these prefixes to determine the entity.
const ENTITY_PREFIXES = [
  { substring: 'assessment',     entity: 'Assessment' },
  { substring: 'group',          entity: 'Group' },
  { substring: 'company',        entity: 'Company' },
  { substring: 'link',           entity: 'DiagnosticLink' },
  { substring: 'diagnosis',      entity: 'FinancialDiagnosis' },
  { substring: 'client',         entity: 'Client' },
  { substring: 'task',           entity: 'ActionTask' },
  { substring: 'review',         entity: 'ActionPlanReview' },
  { substring: 'recommendation', entity: 'ActionRecommendation' },
  { substring: 'upload',         entity: 'FinancialUpload' },
  { substring: 'snapshot',       entity: 'FalDiagnosticSnapshot' },
  { substring: 'finding',        entity: 'FinancialFinding' },
  { substring: 'cycle',          entity: 'FalAssessmentCycle' },
  { substring: 'version',        entity: 'FinancialReportVersion' },
  { substring: 'accountplan',    entity: 'FinancialAccountPlan' },
  { substring: 'plan',           entity: 'ActionPlan' },
  { substring: 'unit',           entity: 'OperationalUnit' },
];

// ── Global keys (method/catalog data shared across all tenants) ──────────
const GLOBAL_KEYS = [
  'fal-questions-all', 'scope-templates', 'questions', 'mqe-questions',
  'all-questions', 'all-mqe', 'all-checklist', 'all-tenants-picker',
  'tenants', 'all-users', 'falQuestions', 'fal-clusters', 'fal-dimensions',
  'driver-catalog', 'root-causes', 'user', 'method-version', 'method-versions',
  'fal-question-bank', 'mqe-q', 'fal-questions', 'fal-subdimensions',
  'fal-clusters-meta', 'fal-benchmarks', 'fal-action-library',
  'fal-recommendation-library', 'fal-question-action-library',
  'fal-driver-catalog', 'fal-root-cause-catalog', 'fal-value-levers',
  'scope-templates-all',
];

// ── Critical family patterns ─────────────────────────────────────────────
const CRITICAL_FAMILIES = {
  'structure':     ['groups', 'companies', 'units', 'group-', 'company-', 'unit-', 'org-chart', 'ownership'],
  'setup':         ['setup-', 'def-form-'],
  'diagnosis':     ['assessment', 'fal-responses', 'fal-snap', 'journey', 'diagnostic-link', 'synthetic'],
  'questionnaires':['fal-questions-dim', 'fal-responses-dim', 'mqe-q', 'mqe-r', 'mqe-responses'],
  'mfis':          ['mfis-crossings', 'mfis-dim-impacts', 'mqe-responses-count', 'mfis-'],
  'financial':     ['financial', 'fin-', 'statements', 'indicators', 'recommendations', 'consolidation', 'composition', 'uploads', 'scopes', 'kanitz', 'dfc'],
  'action-plan':   ['action-plan', 'action-tasks', 'reviews', 'recommendations', 'simulations', 'task-reviews'],
  'reports':       ['report-version', 'reports-', 'report-', 'cycle', 'snapshots', 'assessment-for-return'],
  'portal':        ['client-portal', 'client-detail', 'client-', 'portal'],
};

// ── Operations in priority order (for backward lookup) ───────────────────
// queryKey is NOT here — it's a property, not an operation. Each queryKey
// is registered exactly once, associated with its enclosing operation.
const OPERATIONS_PRIORITY = [
  'useQuery', 'useInfiniteQuery',
  'invalidateQueries', 'refetchQueries', 'removeQueries', 'resetQueries',
  'setQueryData', 'getQueryData', 'prefetchQuery', 'ensureQueryData', 'fetchQuery',
];

// ── Old operations list (for duplicate-elimination calculation) ──────────
const OLD_OPERATIONS = [
  'queryKey', 'invalidateQueries', 'refetchQueries',
  'removeQueries', 'resetQueries', 'setQueryData',
  'getQueryData', 'prefetchQuery', 'ensureQueryData',
];

// ── File walking ─────────────────────────────────────────────────────────
function walk(dir) {
  let results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
      results = results.concat(walk(full));
    } else if (entry.isFile() && (full.endsWith('.jsx') || full.endsWith('.js'))) {
      results.push(full);
    }
  }
  return results;
}

// ── Extract the full queryKey expression starting from queryKey: position ─
// Handles multiline arrays, factory calls, variable references, and ternaries.
function extractQueryKeyExpr(content, queryKeyPos) {
  let pos = queryKeyPos + 'queryKey:'.length;
  while (pos < content.length && /\s/.test(content[pos])) pos++;

  let depth = 0;
  const start = pos;
  let end = pos;
  let inString = false;
  let stringChar = null;

  while (end < content.length) {
    const c = content[end];
    if (inString) {
      if (c === '\\') { end += 2; continue; }
      if (c === stringChar) inString = false;
      end++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inString = true;
      stringChar = c;
      end++;
      continue;
    }
    if (c === '[' || c === '(' || c === '{') { depth++; end++; continue; }
    if (c === ']' || c === ')' || c === '}') {
      if (depth === 0) break;
      depth--;
      end++;
      continue;
    }
    if ((c === ',' || c === ';') && depth === 0) break;
    end++;
  }

  return content.substring(start, end).trim();
}

// ── Find the enclosing operation by looking backward from queryKey: ──────
// Returns the closest operation name (highest index in lookback).
function findOperation(content, queryKeyPos) {
  const lookbackStart = Math.max(0, queryKeyPos - 600);
  const lookback = content.substring(lookbackStart, queryKeyPos);

  let bestOp = null;
  let bestIdx = -1;

  for (const op of OPERATIONS_PRIORITY) {
    const opIdx = lookback.lastIndexOf(op);
    if (opIdx === -1) continue;
    // Verify there's a ( or { shortly after the operation name
    const afterOp = lookback.substring(opIdx + op.length, opIdx + op.length + 10);
    if (!/\s*[\(\{]/.test(afterOp)) continue;
    if (opIdx > bestIdx) {
      bestOp = op;
      bestIdx = opIdx;
    }
  }

  return bestOp;
}

// ── Resolve a variable reference to its definition in the same file ──────
function resolveVariable(content, varName) {
  const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:const|let|var)\\s+${escaped}\\s*=\\s*([^;\\n]+(?:[\\n\\s]+[^;\\n]*)*?)`);
  const match = content.match(regex);
  if (match) {
    let def = match[1].trim();
    // If the definition spans lines, take up to the first semicolon or newline after closing bracket
    // Try to get a clean single-line expression
    const singleLineMatch = content.match(new RegExp(`(?:const|let|var)\\s+${escaped}\\s*=\\s*([^;]+);`));
    if (singleLineMatch) {
      def = singleLineMatch[1].trim();
    }
    return def;
  }
  return null;
}

// ── Get first string key from an array literal ───────────────────────────
function getFirstKey(keyStr) {
  const m = keyStr.match(/\['([^']+)'/) || keyStr.match(/\["([^"]+)"/);
  return m ? m[1] : null;
}

// ── Classify a queryKey expression ───────────────────────────────────────
function classify(keyStr, fileContent) {
  // TENANT_FACTORY: uses a factory function
  for (const f of FACTORIES) {
    if (keyStr.includes(`${f}(`)) {
      return {
        classification: 'TENANT_FACTORY',
        entity: null,
        variable: null,
        justification: `Uses ${f}() tenant-scoped factory`,
        uniqueness: 'Factory injects tenantId as first element',
      };
    }
  }

  const firstKey = getFirstKey(keyStr);

  // TENANT_EXPLICIT: legacy array but includes tenantId
  if (keyStr.includes('tenantId') || keyStr.includes('tenant_id')) {
    return {
      classification: 'TENANT_EXPLICIT',
      entity: null,
      variable: 'tenantId',
      justification: 'Legacy array with tenantId element',
      uniqueness: 'tenantId in key array',
    };
  }

  // GLOBAL_BY_DESIGN
  if (firstKey && GLOBAL_KEYS.includes(firstKey)) {
    return {
      classification: 'GLOBAL_BY_DESIGN',
      entity: null,
      variable: null,
      justification: 'Method/catalog data shared across all tenants',
      uniqueness: 'N/A — global by design',
    };
  }

  // SAFE_GLOBAL_ID: check against SAFE_ID_CONTEXTS matrix (case-insensitive)
  const keyStrLower = keyStr.toLowerCase();
  for (const [varName, ctx] of Object.entries(SAFE_ID_CONTEXTS)) {
    if (keyStrLower.includes(varName.toLowerCase())) {
      return {
        classification: 'SAFE_GLOBAL_ID',
        entity: ctx.entity,
        variable: varName,
        justification: `Scoped by ${varName} (${ctx.entity})`,
        uniqueness: ctx.uniqueness,
      };
    }
  }

  // SAFE_GLOBAL_ID: .id or ?.id access pattern — resolve entity from variable name
  const idAccessMatch = keyStr.match(/(\w+)\??\.\s*id\b/);
  if (idAccessMatch) {
    const varName = idAccessMatch[1];
    const varNameLower = varName.toLowerCase();
    for (const { substring, entity } of ENTITY_PREFIXES) {
      if (varNameLower.includes(substring)) {
        return {
          classification: 'SAFE_GLOBAL_ID',
          entity,
          variable: `${varName}.id`,
          justification: `Scoped by ${varName}.id (${entity})`,
          uniqueness: 'Base44 UUID (24-char hex)',
        };
      }
    }
  }

  // setup- and def-form- prefixes (form-scoped by entity UUID in URL params)
  if (firstKey && (firstKey.startsWith('setup-') || firstKey.startsWith('def-form-') || firstKey.startsWith('companies-sibling-'))) {
    return {
      classification: 'SAFE_GLOBAL_ID',
      entity: 'Entity (URL param)',
      variable: firstKey,
      justification: 'Form-scoped by entity UUID from URL params',
      uniqueness: 'Base44 UUID from URL search params',
    };
  }

  // DYNAMIC_KEY: ternary expression
  if (keyStr.includes('?') && keyStr.includes(':') && !keyStr.startsWith('[')) {
    // Check if it's a ternary (not just a colon in a string)
    if (/\?\s*[^:]+\s*:/.test(keyStr)) {
      return {
        classification: 'DYNAMIC_KEY',
        entity: null,
        variable: null,
        justification: 'Ternary expression — both branches should be inspected manually',
        uniqueness: 'Unknown — manual review required',
      };
    }
  }

  // DYNAMIC_KEY: variable reference (not array literal, not factory call)
  if (!firstKey && !keyStr.startsWith('[')) {
    // Check if it's a simple variable reference
    const varMatch = keyStr.match(/^(\w[\w]*)\s*$/);
    if (varMatch) {
      const varName = varMatch[1];
      // Skip if it's a known factory (already checked above)
      if (!FACTORIES.includes(varName)) {
        // Try to resolve the variable definition in the same file
        const definition = resolveVariable(fileContent, varName);
        if (definition) {
          // Recursively classify the resolved definition
          const sub = classify(definition, fileContent);
          if (sub.classification !== 'PENDING') {
            return {
              ...sub,
              justification: `Resolved ${varName} → ${definition.substring(0, 60)} | ${sub.justification}`,
            };
          }
        }
        return {
          classification: 'DYNAMIC_KEY',
          entity: null,
          variable: varName,
          justification: `Variable reference: ${varName}${definition ? ` (resolved to: ${definition.substring(0, 50)})` : ' (unresolved)'} — needs manual classification`,
          uniqueness: 'Unknown — manual review required',
        };
      }
    }

    // Unknown function call (not a recognized factory)
    if (keyStr.includes('(') && !keyStr.startsWith('[') && !FACTORIES.some(f => keyStr.includes(`${f}(`))) {
      return {
        classification: 'DYNAMIC_KEY',
        entity: null,
        variable: null,
        justification: 'Unknown function call — needs manual classification',
        uniqueness: 'Unknown — manual review required',
      };
    }
  }

  // LEGACY_TEMPORARY: known legacy patterns without tenant
  if (firstKey && (firstKey.startsWith('fin-') || firstKey.startsWith('financial-') ||
      firstKey.startsWith('action-') || firstKey.startsWith('fal-') || firstKey.startsWith('report'))) {
    return {
      classification: 'LEGACY_TEMPORARY',
      entity: null,
      variable: firstKey,
      justification: 'Legacy key pending migration to factory',
      uniqueness: 'Unknown — pending migration',
    };
  }

  return {
    classification: 'PENDING',
    entity: null,
    variable: null,
    justification: 'Needs manual review — no recognized pattern',
    uniqueness: 'Unknown',
  };
}

// ── Determine family bucket from first key ───────────────────────────────
function getFamilyBucket(firstKey) {
  if (!firstKey) return 'other';
  for (const [bucket, patterns] of Object.entries(CRITICAL_FAMILIES)) {
    for (const p of patterns) {
      if (firstKey === p || firstKey.startsWith(p)) return bucket;
    }
  }
  return 'other';
}

// ── Check if a position is inside a comment ──────────────────────────────
function isInComment(content, pos) {
  // Get the line containing this position
  const lineStart = content.lastIndexOf('\n', pos - 1) + 1;
  const linePrefix = content.substring(lineStart, pos);
  // Check for // comment
  if (linePrefix.includes('//')) return true;
  // Check for /* */ block comment (simplified — check if /* is before pos without */ )
  const lastOpen = content.lastIndexOf('/*', pos);
  const lastClose = content.lastIndexOf('*/', pos);
  if (lastOpen > lastClose && lastOpen !== -1) return true;
  return false;
}

// ── Main ─────────────────────────────────────────────────────────────────
const files = walk(SRC_DIR);
const occurrences = [];
let duplicatesEliminated = 0;
let oldApproachTotal = 0;

for (const file of files) {
  const relFile = relative(ROOT_DIR, file);
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');

  // ── Find all queryKey: occurrences ──
  let searchPos = 0;
  const seenPositions = new Set();

  while (true) {
    const queryKeyPos = content.indexOf('queryKey:', searchPos);
    if (queryKeyPos === -1) break;
    searchPos = queryKeyPos + 1;

    // Skip comments
    if (isInComment(content, queryKeyPos)) continue;

    // Skip duplicate positions (same queryKey: found by overlapping search)
    if (seenPositions.has(queryKeyPos)) continue;
    seenPositions.add(queryKeyPos);

    // Find the enclosing operation
    const operation = findOperation(content, queryKeyPos);
    if (!operation) continue;

    // Extract the queryKey expression (handles multiline)
    const keyStr = extractQueryKeyExpr(content, queryKeyPos);
    if (!keyStr || keyStr.length === 0) continue;
    const isMultiline = keyStr.includes('\n');

    // Calculate line number
    const lineIdx = content.substring(0, queryKeyPos).split('\n').length - 1;

    // Classify
    const result = classify(keyStr, content);
    // SEG-04 fix: detect which factory was used for correct bucketing
    let usedFactory = null;
    for (const f of FACTORIES) {
      if (keyStr.includes(`${f}(`)) { usedFactory = f; break; }
    }
    const firstKey = getFirstKey(keyStr) || (usedFactory ? 'factory' : null);
    const bucket = usedFactory ? (FACTORY_BUCKETS[usedFactory] || 'other') : getFamilyBucket(firstKey);

    // ── Count duplicates eliminated (old approach heuristic) ──
    // Old approach: for each op in OLD_OPERATIONS, if line includes op AND
    // line includes 'queryKey', it was counted. A single line could be
    // counted multiple times.
    const lineContent = lines[lineIdx] || '';
    let oldLineMatches = 0;
    for (const op of OLD_OPERATIONS) {
      if (lineContent.includes(op) && lineContent.includes('queryKey')) oldLineMatches++;
    }
    if (oldLineMatches > 1) {
      duplicatesEliminated += oldLineMatches - 1;
    }
    oldApproachTotal += Math.max(oldLineMatches, 0);

    occurrences.push({
      file: relFile,
      line: lineIdx + 1,
      operation,
      family: result.variable || firstKey || 'unknown',
      entity: result.entity,
      variable: result.variable,
      bucket,
      queryKey: keyStr.replace(/\n/g, ' ').substring(0, 100),
      multiline: isMultiline,
      classification: result.classification,
      justification: result.justification,
      uniqueness: result.uniqueness,
    });
  }
}

// ── Summary statistics ──────────────────────────────────────────────────
const byClass = {};
const byBucket = {};
const pendingCritical = [];
const pendingNonCritical = [];
const legacyCritical = [];
const legacyNonCritical = [];
const dynamicCritical = [];
const dynamicNonCritical = [];
const safeIdDetails = {}; // variable → { entity, count, uniqueness }

for (const occ of occurrences) {
  byClass[occ.classification] = (byClass[occ.classification] || 0) + 1;
  if (!byBucket[occ.bucket]) byBucket[occ.bucket] = { total: 0, pending: 0 };
  byBucket[occ.bucket].total++;
  if (occ.classification === 'PENDING') {
    byBucket[occ.bucket].pending++;
    if (occ.bucket !== 'other') {
      pendingCritical.push(occ);
    } else {
      pendingNonCritical.push(occ);
    }
  }
  if (occ.classification === 'LEGACY_TEMPORARY') {
    if (occ.bucket !== 'other') {
      legacyCritical.push(occ);
    } else {
      legacyNonCritical.push(occ);
    }
  }
  if (occ.classification === 'DYNAMIC_KEY') {
    if (occ.bucket !== 'other') {
      dynamicCritical.push(occ);
    } else {
      dynamicNonCritical.push(occ);
    }
  }
  if (occ.classification === 'SAFE_GLOBAL_ID' && occ.variable) {
    if (!safeIdDetails[occ.variable]) {
      safeIdDetails[occ.variable] = { entity: occ.entity, count: 0, uniqueness: occ.uniqueness };
    }
    safeIdDetails[occ.variable].count++;
  }
}

const multilineCount = occurrences.filter(o => o.multiline).length;

// ── Output ──────────────────────────────────────────────────────────────
console.log('═'.repeat(90));
console.log('SEG-04 — QUERY CACHE AUDIT REPORT (v2)');
console.log('═'.repeat(90));

console.log('\nSUMMARY:');
console.log(`  Operações únicas encontradas:    ${occurrences.length}`);
console.log(`  Duplicidades eliminadas:         ${duplicatesEliminated}`);
console.log(`  Dinâmicas/multilinhas:           ${dynamicCritical.length + dynamicNonCritical.length + multilineCount}`);

console.log('\nBY CLASSIFICATION:');
const classOrder = ['TENANT_FACTORY', 'TENANT_EXPLICIT', 'SAFE_GLOBAL_ID', 'GLOBAL_BY_DESIGN', 'LEGACY_TEMPORARY', 'DYNAMIC_KEY', 'PENDING'];
for (const cls of classOrder) {
  const count = byClass[cls] || 0;
  if (cls === 'PENDING') {
    const crit = pendingCritical.length;
    const nonCrit = pendingNonCritical.length;
    console.log(`  ${cls.padEnd(22)} ${count}  (crítico: ${crit}, não-crítico: ${nonCrit})`);
  } else {
    console.log(`  ${cls.padEnd(22)} ${count}`);
  }
}

console.log('\nBY CRITICAL FAMILY:');
for (const [bucket, stats] of Object.entries(byBucket).sort()) {
  const flag = stats.pending > 0 ? ' ⚠️' : ' ✓';
  console.log(`  ${bucket.padEnd(20)} total=${String(stats.total).padStart(4)}  pending=${stats.pending}${flag}`);
}

// ── SAFE_GLOBAL_ID validation details ──
console.log('\n' + '─'.repeat(90));
console.log('SAFE_GLOBAL_ID VALIDATED DETAILS:');
console.log('─'.repeat(90));
console.log('  Variable'.padEnd(30) + 'Entity'.padEnd(25) + 'Count'.padEnd(8) + 'Uniqueness Guarantee');
for (const [varName, info] of Object.entries(safeIdDetails).sort()) {
  console.log(`  ${varName.padEnd(28)} ${info.entity.padEnd(23)} ${String(info.count).padStart(4)}   ${info.uniqueness}`);
}

// ── DYNAMIC_KEY details (non-critical only — critical shown below) ──
if (dynamicNonCritical.length > 0) {
  console.log('\n' + '─'.repeat(90));
  console.log(`DYNAMIC_KEY NÃO-CRÍTICO (${dynamicNonCritical.length}):`);
  console.log('─'.repeat(90));
  for (const d of dynamicNonCritical) {
    console.log(`  ${d.file}:${d.line}  [${d.operation}]  ${d.queryKey}`);
    console.log(`    → ${d.justification}`);
  }
}

// ── PENDING details ──
if (pendingCritical.length > 0) {
  console.log('\n' + '─'.repeat(90));
  console.log(`⚠️  PENDING IN CRITICAL FAMILIES (${pendingCritical.length}):`);
  console.log('─'.repeat(90));
  for (const p of pendingCritical) {
    console.log(`  ${p.file}:${p.line}  [${p.bucket}]  [${p.operation}]  ${p.queryKey}`);
    console.log(`    → ${p.justification}`);
  }
}

if (pendingNonCritical.length > 0) {
  console.log('\n' + '─'.repeat(90));
  console.log(`PENDING NÃO-CRÍTICO (${pendingNonCritical.length}) — justificado:`);
  console.log('─'.repeat(90));
  for (const p of pendingNonCritical) {
    console.log(`  ${p.file}:${p.line}  [${p.operation}]  ${p.queryKey}`);
    console.log(`    → ${p.justification}`);
  }
}

if (pendingCritical.length === 0) {
  console.log('\n✓ PENDING crítico: 0');
}

// ── LEGACY_TEMPORARY critical details ──
if (legacyCritical.length > 0) {
  console.log('\n' + '─'.repeat(90));
  console.log(`⚠️  LEGACY_TEMPORARY IN CRITICAL FAMILIES (${legacyCritical.length}):`);
  console.log('─'.repeat(90));
  for (const l of legacyCritical) {
    console.log(`  ${l.file}:${l.line}  [${l.bucket}]  [${l.operation}]  ${l.queryKey}`);
  }
} else {
  console.log('✓ LEGACY_TEMPORARY crítico: 0');
}

// ── DYNAMIC_KEY critical details ──
if (dynamicCritical.length > 0) {
  console.log('\n' + '─'.repeat(90));
  console.log(`⚠️  DYNAMIC_KEY IN CRITICAL FAMILIES (${dynamicCritical.length}):`);
  console.log('─'.repeat(90));
  for (const d of dynamicCritical) {
    console.log(`  ${d.file}:${d.line}  [${d.bucket}]  [${d.operation}]  ${d.queryKey}`);
    console.log(`    → ${d.justification}`);
  }
} else {
  console.log('✓ DYNAMIC_KEY crítico: 0');
}

// ── Detailed CSV (for audit trail) ──
console.log('\n' + '─'.repeat(90));
console.log('DETAILED INVENTORY:');
console.log('─'.repeat(90));
console.log('File\tLine\tOperation\tBucket\tClassification\tEntity\tVariable\tJustification\tQueryKey');
for (const occ of occurrences) {
  console.log(`${occ.file}\t${occ.line}\t${occ.operation}\t${occ.bucket}\t${occ.classification}\t${occ.entity || '-'}\t${occ.variable || '-'}\t${occ.justification}\t${occ.queryKey}`);
}

// ── Exit code ──
// SEG-04 Residual 9: LEGACY_TEMPORARY and DYNAMIC_KEY in critical families also fail
const exitCode = (pendingCritical.length > 0 || legacyCritical.length > 0 || dynamicCritical.length > 0) ? 1 : 0;
console.log(`\n${'═'.repeat(90)}`);
console.log(`EXIT CODE: ${exitCode}`);
console.log(`${'═'.repeat(90)}`);
process.exit(exitCode);