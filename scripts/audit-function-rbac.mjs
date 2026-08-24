#!/usr/bin/env node
/**
 * SEG-03 — semantic RBAC audit, FASE 2 RESIDUAL 4.
 * The policy for every invokable function is derived from the reconciled
 * SEG-02 matrix. Mutating endpoints require an effective policy guard before
 * the first mutation in the Deno.serve handler.
 */
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const functionsDir = join(root, 'base44', 'functions');
const matrixPath = join(root, 'src', 'docs', 'SEG-02_FUNCTION_AUDIT.md');
const MUTATION_RE = /\.(?:create|update|delete|bulkCreate|bulkUpdate|deleteMany|updateMany)\s*\(/g;

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function parseMatrix() {
  const rows = new Map();
  for (const line of readFileSync(matrixPath, 'utf8').split('\n')) {
    if (!/^\|\s*\d+\s*\|/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    const name = cells[1];
    rows.set(name, { name, roles: cells[8], trust: cells[9], classification: cells[10], justification: cells[11] });
  }
  return rows;
}

function handlerBody(source) {
  const start = source.indexOf('Deno.serve');
  return start < 0 ? source : source.slice(start);
}

function derivePolicy(row, body) {
  const hasMutation = MUTATION_RE.test(body);
  MUTATION_RE.lastIndex = 0;
  if (!hasMutation) return 'READ_ONLY';
  if (row.classification === 'AUTOMATION_TRUST') return 'AUTOMATION_TRUST';
  if (/self-service/i.test(row.trust) || /próprio perfil|own email/i.test(row.justification)) return 'SELF_SERVICE';
  if (row.classification === 'HQ_GLOBAL' || row.roles === 'hq_admin') return 'HQ_ONLY';
  if (row.classification === 'TENANT_ADMIN_SCOPED') return 'TENANT_ADMIN_SCOPED';
  return 'WRITE_ROLES';
}

function firstMutationIndex(body) {
  const match = MUTATION_RE.exec(body);
  MUTATION_RE.lastIndex = 0;
  return match ? match.index : -1;
}

function guardIndex(body, policy) {
  const patterns = {
    WRITE_ROLES: [
      /if\s*\(\s*!\s*WRITE_ROLES\s*\.\s*has\s*\(\s*appRole\s*\)\s*\)/,
      /if\s*\(\s*!\s*WRITE_ROLES\s*\.\s*includes\s*\(\s*appRole\s*\)\s*\)/,
      /assertCanWrite\s*\(\s*(?:appRole|effectiveRole|role)\s*\)/,
      /if\s*\(\s*!\s*\[\s*['"]hq_admin['"]\s*,\s*['"]tenant_admin['"]\s*,\s*['"]consultant['"]\s*\]\s*\.includes\([^)]*\)\s*\)/,
      /if\s*\(\s*!\s*ALLOWED_ROLES\s*\.has\(/,
    ],
    TENANT_ADMIN_SCOPED: [
      /if\s*\(\s*!\s*(?:ALLOWED_DELETE_ROLES|DELETE_ROLES|WRITE_ROLES)\s*\.\s*(?:has|includes)\s*\(\s*appRole\s*\)\s*\)/,
      /if\s*\(\s*!\s*\[\s*['"]hq_admin['"]\s*,\s*['"]tenant_admin['"]\s*\]\s*\.includes\(/,
      /if\s*\(\s*(?:appRole|actorRole|actorAppRole)\s*!==\s*['"]hq_admin['"]\s*&&\s*(?:appRole|actorRole|actorAppRole)\s*!==\s*['"]tenant_admin['"]\s*\)/,
      /\[\s*['"]hq_admin['"]\s*,\s*['"]tenant_admin['"]\s*\]\s*\.includes\(/,
      /if\s*\(\s*!\s*canManageAccess\s*\(/,
      /if\s*\(\s*actorAppRole\s*!==\s*['"]hq_admin['"]\s*&&\s*actorAppRole\s*!==\s*['"]tenant_admin['"]\s*\)/,
    ],
    HQ_ONLY: [
      /if\s*\(\s*appRole\s*!==\s*['"]hq_admin['"]\s*\)/,
      /if\s*\(\s*actorAppRole\s*!==\s*['"]hq_admin['"]\s*\)/,
      /if\s*\(\s*user\??\.role\s*!==\s*['"]admin['"]\s*\)/,
    ],
  };
  const indices = (patterns[policy] || []).map((re) => body.search(re)).filter((idx) => idx >= 0);
  return indices.length ? Math.min(...indices) : -1;
}

const matrix = parseMatrix();
const functionNames = readdirSync(functionsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== '_shared')
  .map((entry) => entry.name).sort();
const violations = [];
const policies = [];

for (const name of functionNames) {
  const row = matrix.get(name);
  if (!row) { violations.push({ name, reason: 'missing explicit SEG-02 policy row' }); continue; }
  const source = readFileSync(join(functionsDir, name, 'entry.ts'), 'utf8');
  const body = stripComments(handlerBody(source));
  const policy = derivePolicy(row, body);
  policies.push({ name, policy });
  const mutationIdx = firstMutationIndex(body);

  if (policy === 'READ_ONLY') continue;
  if (!/base44\.auth\.me\s*\(\s*\)/.test(body) && policy !== 'AUTOMATION_TRUST') {
    violations.push({ name, reason: `${policy}: identity is not derived from auth.me()` });
    continue;
  }
  if (policy === 'SELF_SERVICE') {
    const ownIdentity = /email\s*:\s*(?:user|actor)\.email|User\.update\s*\(\s*(?:user|actor)\.id/.test(body);
    const arbitraryIdentity = /(?:const|let|var)\s*\{[^}]*\b(?:email|user_id)\b[^}]*\}\s*=\s*(?:await\s+)?req\.json/.test(body);
    if (!ownIdentity || arbitraryIdentity) violations.push({ name, reason: 'SELF_SERVICE must use auth.me() identity and reject body email/user_id' });
    continue;
  }
  if (policy === 'AUTOMATION_TRUST') {
    const eventResource = /(?:event|data|old_data)/.test(body) && /asServiceRole\.entities\.[A-Za-z0-9_]+\.get\s*\(/.test(body);
    const freeTenant = /\btenant_id\s*[:=]\s*(?:body\.|payload\.|event\.)tenant_id/.test(body);
    if (!eventResource || freeTenant) violations.push({ name, reason: 'AUTOMATION_TRUST must derive resource/tenant from event resource, not free tenant_id' });
    continue;
  }
  const idx = guardIndex(body, policy);
  if (idx < 0) violations.push({ name, reason: `${policy}: no effective policy guard` });
  else if (mutationIdx >= 0 && idx > mutationIdx) violations.push({ name, reason: `${policy}: guard appears after first mutation` });
}

for (const name of matrix.keys()) if (!functionNames.includes(name)) violations.push({ name, reason: 'matrix policy has no invokable function' });

const counts = policies.reduce((acc, row) => ({ ...acc, [row.policy]: (acc[row.policy] || 0) + 1 }), {});
console.log('═'.repeat(96));
console.log('SEG-03 — EXPLICIT FUNCTION RBAC POLICY AUDIT (RESIDUAL 4)');
console.log('═'.repeat(96));
console.log(`Functions classified: ${policies.length}/${functionNames.length}`);
for (const [policy, count] of Object.entries(counts).sort()) console.log(`  ${policy}: ${count}`);
console.log(`Violations: ${violations.length}`);
for (const item of violations) console.log(`  ${item.name}: ${item.reason}`);
process.exit(violations.length ? 1 : 0);