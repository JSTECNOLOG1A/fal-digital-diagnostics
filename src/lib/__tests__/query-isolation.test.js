/**
 * SEC-015 — Query Family Tenant Isolation Test
 * =====================================================================
 * Verifies that query keys are tenant-scoped and that invalidation
 * of Tenant A does NOT affect Tenant B's cached queries.
 *
 * Tests both sides: A must be invalidated, B must be preserved.
 * Uses getQueryState().isInvalidated (not just getQueryData).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  tenantKey,
  financialKey,
  assessmentKey,
  groupKey,
  companyKey,
  unitKey,
  actionPlanKey,
  reportKey,
  clientPortalKey,
  invalidateFinancialQueries,
  invalidateActionPlanQueries,
  invalidateAssessmentQueries,
  invalidateStructureQueries,
  invalidateReportQueries,
  invalidatePortalQueries,
} from '@/lib/query-client';

describe('SEC-015 — Query Key Factories', () => {
  it('financialKey produces tenant-scoped keys', () => {
    const keyA = financialKey('tenant-a', 'diag-1', 'statements');
    const keyB = financialKey('tenant-b', 'diag-1', 'statements');
    expect(keyA).toEqual(['tenant', 'tenant-a', 'financial', 'diag-1', 'statements']);
    expect(keyB).toEqual(['tenant', 'tenant-b', 'financial', 'diag-1', 'statements']);
    expect(keyA).not.toEqual(keyB);
  });

  it('assessmentKey produces tenant-scoped keys', () => {
    const keyA = assessmentKey('tenant-a', 'asmt-1', 'scores');
    const keyB = assessmentKey('tenant-b', 'asmt-1', 'scores');
    expect(keyA[1]).toBe('tenant-a');
    expect(keyB[1]).toBe('tenant-b');
    expect(keyA).not.toEqual(keyB);
  });

  it('groupKey produces tenant-scoped keys', () => {
    const key = groupKey('tenant-a', 'grp-1', 'structure');
    expect(key).toEqual(['tenant', 'tenant-a', 'group', 'grp-1', 'structure']);
  });

  it('companyKey produces tenant-scoped keys', () => {
    const key = companyKey('tenant-a', 'comp-1', 'detail');
    expect(key).toEqual(['tenant', 'tenant-a', 'company', 'comp-1', 'detail']);
  });

  it('unitKey produces tenant-scoped keys', () => {
    const key = unitKey('tenant-a', 'unit-1', 'detail');
    expect(key).toEqual(['tenant', 'tenant-a', 'unit', 'unit-1', 'detail']);
  });

  it('actionPlanKey produces tenant-scoped keys', () => {
    const key = actionPlanKey('tenant-a', 'asmt-1', 'plan-1', 'tasks');
    expect(key).toEqual(['tenant', 'tenant-a', 'actionplan', 'asmt-1', 'plan-1', 'tasks']);
  });

  it('reportKey produces tenant-scoped keys', () => {
    const key = reportKey('tenant-a', 'asmt-1', 'versions');
    expect(key).toEqual(['tenant', 'tenant-a', 'report', 'asmt-1', 'versions']);
  });

  it('clientPortalKey produces tenant-scoped keys', () => {
    const key = clientPortalKey('tenant-a', 'client-1', 'dashboard');
    expect(key).toEqual(['tenant', 'tenant-a', 'portal', 'client-1', 'dashboard']);
  });
});

// ── Helper: seed a query and register it as active ──────────────────────────
function seedQuery(queryClient, key, data) {
  queryClient.setQueryData(key, data);
  // Touch the query observer so getQueryState returns a real state
  const observer = queryClient.getQueryCache().find(key);
  if (observer) {
    observer.setState({ data, status: 'success', dataUpdatedAt: Date.now() });
  }
}

describe('SEC-015 — Tenant Isolation: Invalidating A does NOT affect B', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
  });

  // ── Financial ──
  it('Financial: A invalidated = true, B invalidated = false', async () => {
    const keyA = financialKey('tenant-a', 'diag-1', 'statements');
    const keyB = financialKey('tenant-b', 'diag-1', 'statements');

    seedQuery(queryClient, keyA, { data: 'A' });
    seedQuery(queryClient, keyB, { data: 'B' });

    await invalidateFinancialQueries(queryClient, 'diag-1', 'tenant-a');

    expect(queryClient.getQueryState(keyA)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(keyB)?.isInvalidated).toBe(false);
  });

  // ── ActionPlan ──
  it('ActionPlan: A invalidated = true, B invalidated = false', async () => {
    const keyA = actionPlanKey('tenant-a', 'asmt-1', 'plan-1', 'tasks');
    const keyB = actionPlanKey('tenant-b', 'asmt-1', 'plan-1', 'tasks');

    seedQuery(queryClient, keyA, { data: 'A-tasks' });
    seedQuery(queryClient, keyB, { data: 'B-tasks' });

    await invalidateActionPlanQueries(queryClient, 'asmt-1', 'plan-1', 'tenant-a');

    expect(queryClient.getQueryState(keyA)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(keyB)?.isInvalidated).toBe(false);
  });

  // ── Assessment ──
  it('Assessment: A invalidated = true, B invalidated = false', async () => {
    const keyA = assessmentKey('tenant-a', 'asmt-1', 'scores');
    const keyB = assessmentKey('tenant-b', 'asmt-1', 'scores');

    seedQuery(queryClient, keyA, { data: 'A-scores' });
    seedQuery(queryClient, keyB, { data: 'B-scores' });

    await invalidateAssessmentQueries(queryClient, 'asmt-1', 'tenant-a');

    expect(queryClient.getQueryState(keyA)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(keyB)?.isInvalidated).toBe(false);
  });

  // ── Structure (group) ──
  it('Structure (group): A invalidated = true, B invalidated = false', async () => {
    const keyA = groupKey('tenant-a', 'grp-1', 'structure');
    const keyB = groupKey('tenant-b', 'grp-1', 'structure');

    seedQuery(queryClient, keyA, { data: 'A-structure' });
    seedQuery(queryClient, keyB, { data: 'B-structure' });

    await invalidateStructureQueries(queryClient, 'tenant-a', 'group');

    expect(queryClient.getQueryState(keyA)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(keyB)?.isInvalidated).toBe(false);
  });

  // ── Structure (company) ──
  it('Structure (company): A invalidated = true, B invalidated = false', async () => {
    const keyA = companyKey('tenant-a', 'comp-1', 'detail');
    const keyB = companyKey('tenant-b', 'comp-1', 'detail');

    seedQuery(queryClient, keyA, { data: 'A-company' });
    seedQuery(queryClient, keyB, { data: 'B-company' });

    await invalidateStructureQueries(queryClient, 'tenant-a', 'company');

    expect(queryClient.getQueryState(keyA)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(keyB)?.isInvalidated).toBe(false);
  });

  // ── Structure (unit) ──
  it('Structure (unit): A invalidated = true, B invalidated = false', async () => {
    const keyA = unitKey('tenant-a', 'unit-1', 'detail');
    const keyB = unitKey('tenant-b', 'unit-1', 'detail');

    seedQuery(queryClient, keyA, { data: 'A-unit' });
    seedQuery(queryClient, keyB, { data: 'B-unit' });

    await invalidateStructureQueries(queryClient, 'tenant-a', 'unit');

    expect(queryClient.getQueryState(keyA)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(keyB)?.isInvalidated).toBe(false);
  });

  // ── Reports ──
  it('Reports: A invalidated = true, B invalidated = false', async () => {
    const keyA = reportKey('tenant-a', 'asmt-1', 'versions');
    const keyB = reportKey('tenant-b', 'asmt-1', 'versions');

    seedQuery(queryClient, keyA, { data: 'A-versions' });
    seedQuery(queryClient, keyB, { data: 'B-versions' });

    await invalidateReportQueries(queryClient, 'asmt-1', 'tenant-a');

    expect(queryClient.getQueryState(keyA)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(keyB)?.isInvalidated).toBe(false);
  });

  // ── Portal ──
  it('Portal: A invalidated = true, B invalidated = false', async () => {
    const keyA = clientPortalKey('tenant-a', 'client-1', 'dashboard');
    const keyB = clientPortalKey('tenant-b', 'client-1', 'dashboard');

    seedQuery(queryClient, keyA, { data: 'A-portal' });
    seedQuery(queryClient, keyB, { data: 'B-portal' });

    await invalidatePortalQueries(queryClient, 'client-1', 'tenant-a');

    expect(queryClient.getQueryState(keyA)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(keyB)?.isInvalidated).toBe(false);
  });

  // ── Cross-tenant with same entity ID ──
  it('cross-tenant keys with same diagnosis ID are distinct', () => {
    const keyA = financialKey('tenant-a', 'diag-shared', 'meta');
    const keyB = financialKey('tenant-b', 'diag-shared', 'meta');

    expect(keyA).not.toEqual(keyB);
    expect(keyA[1]).toBe('tenant-a');
    expect(keyB[1]).toBe('tenant-b');
  });
});

// ── SEC-015 Residual 9: Active legacy producer scan ─────────────────────────
// Scans the ACTUAL codebase for queryKey arrays that are NOT tenant-scoped
// factories and belong to critical families. Asserts zero active legacy producers.
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname_test = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = join(__dirname_test, '..', '..', '..');

const FACTORIES_SET = new Set([
  'tenantKey', 'financialKey', 'assessmentKey', 'groupKey',
  'companyKey', 'unitKey', 'actionPlanKey', 'reportKey', 'clientPortalKey',
]);

// Patterns explicitly migrated in Residual 9 — these MUST be gone.
const MIGRATED_PATTERNS = [
  'financial-block', 'financial-findings-block',
  'report-version-detail', 'assessment-for-return',
  'report-payload-snapshot', 'report-payload',
];

function walkForJsx(dir) {
  let results = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '__tests__') {
        results = results.concat(walkForJsx(full));
      } else if (entry.isFile() && (full.endsWith('.jsx') || full.endsWith('.js'))) {
        results.push(full);
      }
    }
  } catch { /* ignore */ }
  return results;
}

describe('SEC-015 — Active legacy producers in critical families = 0', () => {
  it('no critical-family queryKey uses a non-factory legacy array', () => {
    const files = walkForJsx(SRC_ROOT);
    const violations = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      // Find all queryKey: occurrences
      let pos = 0;
      while (true) {
        const idx = content.indexOf('queryKey:', pos);
        if (idx === -1) break;
        pos = idx + 1;

        // Skip comments
        const lineStart = content.lastIndexOf('\n', idx - 1) + 1;
        if (content.substring(lineStart, idx).includes('//')) continue;

        // Extract the expression after queryKey:
        let end = idx + 'queryKey:'.length;
        while (end < content.length && /\s/.test(content[end])) end++;
        const exprStart = end;

        // Check if it uses a factory
        let usesFactory = false;
        for (const f of FACTORIES_SET) {
          if (content.substring(exprStart, exprStart + f.length + 2) === `${f}(`) {
            usesFactory = true;
            break;
          }
        }
        if (usesFactory) continue;

        // Extract first string key from array literal
        const afterExpr = content.substring(exprStart, exprStart + 200);
        const strMatch = afterExpr.match(/^\[?\s*['"]([^'"]+)['"]/);
        if (!strMatch) continue;
        const firstKey = strMatch[1];

        // Check if it's a migrated pattern that should now be gone
        const isLegacy = MIGRATED_PATTERNS.some(
          (p) => firstKey === p || firstKey.startsWith(p)
        );
        if (isLegacy) {
          const lineNum = content.substring(0, idx).split('\n').length;
          const relPath = file.replace(SRC_ROOT + '/', '');
          violations.push(`${relPath}:${lineNum} → ['${firstKey}', ...]`);
        }
      }
    }

    if (violations.length > 0) {
      console.error('Legacy producers found:\n' + violations.join('\n'));
    }
    expect(violations).toEqual([]);
  });
});