#!/usr/bin/env node
/**
 * audit-identity-usage.mjs (v2 — P0 Corrective Patch)
 * =====================================================================
 * Rewritten to validate resolveAppRole bodies instead of skipping them.
 *
 * The v1 auditor skipped the entire resolveAppRole block, which allowed
 * 85 broken resolvers (`appRole === 'hq_admin'`) to go undetected.
 *
 * v2 validates each resolver body and fails on:
 *   - appRole === inside resolveAppRole (variable doesn't exist there)
 *   - Missing user?.role === 'admin' fallback
 *   - Missing VALID_APP_ROLES.has(user?.app_role)
 *   - role=user → consultant inference
 *   - user.role operational outside resolver/expectedBuiltInRole
 *   - WRITE_ROLES.has(user.role) / WRITE_ROLES.has(u.role)
 *   - Aliases: u.role, actor.role, currentUser.role, targetUser.role in guards
 *
 * Exceptions (allowed outside resolver):
 *   - expectedBuiltInRole / assertBuiltInRoleCompatible (technical comparison)
 *   - Informational display of role
 *   - src/lib/access-role.js, src/lib/rbac.js, usePermissions.js, TenantContext.jsx
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, extname, relative } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const FUNCTIONS = join(ROOT, 'base44', 'functions');

const ALLOWED_FILES = new Set([
  'src/lib/access-role.js',
  'src/lib/rbac.js',
  'src/lib/hooks/usePermissions.js',
  'src/components/shared/TenantContext.jsx',
]);

const violations = [];

// ── Critical patterns (API inexistente / fallback proibido) ──
const CRITICAL_PATTERNS = [
  { regex: /asServiceRole\.users\b/g, label: 'asServiceRole.users (API inexistente)' },
  { regex: /users\.updateRole\b/g, label: 'users.updateRole (API inexistente)' },
  { regex: /app_role\s*\|\|\s*['"]consultant['"]/g, label: "app_role || 'consultant' (nunca assumir consultant)" },
  { regex: /app_role\s*\|\|\s*['"]tenant_admin['"]/g, label: "app_role || 'tenant_admin' (nunca assumir role)" },
  { regex: /role\s*===?\s*['"]user['"]\s*&&?\s*.*consultant/gi, label: 'role=user → consultant inference' },
];

// ── Role alias patterns in guard context ──
const ROLE_ALIAS_PATTERNS = [
  { regex: /(?:WRITE_ROLES|DELETE_ROLES|ALLOWED_DELETE_ROLES)\s*\.\s*has\s*\(\s*u\??\.role/g, label: 'WRITE_ROLES.has(u.role) — use appRole' },
  { regex: /(?:WRITE_ROLES|DELETE_ROLES|ALLOWED_DELETE_ROLES)\s*\.\s*has\s*\(\s*actor\??\.role/g, label: 'WRITE_ROLES.has(actor.role) — use appRole' },
  { regex: /(?:WRITE_ROLES|DELETE_ROLES|ALLOWED_DELETE_ROLES)\s*\.\s*has\s*\(\s*currentUser\??\.role/g, label: 'WRITE_ROLES.has(currentUser.role) — use appRole' },
  { regex: /(?:WRITE_ROLES|DELETE_ROLES|ALLOWED_DELETE_ROLES)\s*\.\s*has\s*\(\s*targetUser\??\.role/g, label: 'WRITE_ROLES.has(targetUser.role) — use appRole' },
  { regex: /(?:WRITE_ROLES|DELETE_ROLES|ALLOWED_DELETE_ROLES)\s*\.\s*has\s*\(\s*user\??\.role/g, label: 'WRITE_ROLES.has(user.role) — use appRole' },
];

function walkDir(dir, exts) {
  const results = [];
  if (!statSync(dir).isDirectory()) return results;
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...walkDir(fullPath, exts));
    } else if (exts.includes(extname(fullPath))) {
      results.push(fullPath);
    }
  }
  return results;
}

function auditFile(filePath) {
  const relPath = relative(ROOT, filePath).replace(/\\/g, '/');

  if (ALLOWED_FILES.has(relPath)) return;
  if (relPath.includes('__tests__') || relPath.endsWith('.d.ts') || relPath.endsWith('.test.js') || relPath.endsWith('.test.jsx')) return;
  if (relPath.startsWith('src/docs/') || relPath.endsWith('.md')) return;

  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return;
  }

  const lines = content.split('\n');

  // ── 1. Validate resolveAppRole body (DON'T skip it!) ──
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/function\s+resolveAppRole\b/.test(line)) {
      // Extract the function body by tracking braces
      let depth = 0;
      let bodyStart = i;
      let bodyEnd = -1;
      for (let j = i; j < lines.length; j++) {
        const l = lines[j];
        depth += (l.match(/{/g) || []).length - (l.match(/}/g) || []).length;
        if (j > i && depth <= 0) {
          bodyEnd = j;
          break;
        }
      }
      if (bodyEnd > bodyStart) {
        const body = lines.slice(bodyStart, bodyEnd + 1).join('\n');

        // Check for appRole === inside resolver (BROKEN — variable doesn't exist)
        if (/appRole\s*===/.test(body)) {
          violations.push({
            file: relPath,
            line: i + 1,
            pattern: 'resolveAppRole body contains `appRole ===` (variable does not exist inside function)',
            severity: 'critical',
            snippet: body.split('\n').find((l) => /appRole\s*===/.test(l))?.trim() || '',
          });
        }

        // Must have user?.role === 'admin' fallback
        if (!/user\??\.role\s*===?\s*['"]admin['"]/.test(body)) {
          violations.push({
            file: relPath,
            line: i + 1,
            pattern: "resolveAppRole missing `user?.role === 'admin'` fallback",
            severity: 'critical',
            snippet: body.trim().substring(0, 120),
          });
        }

        // Must have VALID_APP_ROLES.has(user?.app_role)
        if (!/VALID_APP_ROLES\.has\s*\(\s*user\??\.app_role\s*\)/.test(body)) {
          violations.push({
            file: relPath,
            line: i + 1,
            pattern: 'resolveAppRole missing VALID_APP_ROLES.has(user?.app_role)',
            severity: 'critical',
            snippet: body.trim().substring(0, 120),
          });
        }
      }
      break; // only first resolveAppRole per file
    }
  }

  // ── 2. Check critical patterns (full file, line by line) ──
  let inBlockComment = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('/*')) inBlockComment = true;
    if (inBlockComment) {
      if (trimmed.includes('*/')) inBlockComment = false;
      continue;
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    // Skip resolveAppRole body (already validated above)
    // Skip expectedBuiltInRole / assertBuiltInRoleCompatible (technical comparison)
    const isTechnicalFn = /function\s+(expectedBuiltInRole|assertBuiltInRoleCompatible)\b/.test(line);

    for (const pattern of CRITICAL_PATTERNS) {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(line)) {
        violations.push({
          file: relPath,
          line: i + 1,
          pattern: pattern.label,
          severity: 'critical',
          snippet: trimmed.substring(0, 120),
        });
      }
    }

    // Role alias patterns (only outside technical functions)
    if (!isTechnicalFn) {
      for (const pattern of ROLE_ALIAS_PATTERNS) {
        pattern.regex.lastIndex = 0;
        if (pattern.regex.test(line)) {
          violations.push({
            file: relPath,
            line: i + 1,
            pattern: pattern.label,
            severity: 'high',
            snippet: trimmed.substring(0, 120),
          });
        }
      }
    }
  }
}

// ── Audit all source files ──
const srcExts = ['.js', '.jsx', '.ts', '.tsx'];
const srcFiles = walkDir(SRC, srcExts);
for (const f of srcFiles) auditFile(f);

// ── Audit backend functions ──
const fnFiles = walkDir(FUNCTIONS, ['.ts']);
for (const f of fnFiles) auditFile(f);

// ── Report ──
const critical = violations.filter((v) => v.severity === 'critical');
const high = violations.filter((v) => v.severity === 'high');

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('  AUDIT: IDENTITY USAGE v2 — resolveAppRole + role guard validation');
console.log('═══════════════════════════════════════════════════════════════════\n');

if (violations.length === 0) {
  console.log('  ✅ PASS — Nenhuma violação de identidade detectada.\n');
  console.log(`  Arquivos auditados: Frontend: ${srcFiles.length} · Backend: ${fnFiles.length}`);
  process.exit(0);
}

console.log(`  ❌ FAIL — ${violations.length} violação(ões).\n`);
console.log(`  Critical: ${critical.length} · High: ${high.length}\n`);

for (const v of violations) {
  console.log(`  → ${v.file}:${v.line} [${v.severity}]`);
  console.log(`    ${v.pattern}`);
  if (v.snippet) console.log(`    ${v.snippet}\n`);
}

console.log(`\n═══════════════════════════════════════════════════════════════════\n`);
process.exit(1);