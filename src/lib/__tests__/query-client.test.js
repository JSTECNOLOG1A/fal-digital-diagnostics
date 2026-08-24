import { describe, it, expect } from 'vitest';
import {
  tenantKey,
  financialKey,
  assessmentKey,
  invalidateFinancialQueries,
  queryClientInstance,
} from '@/lib/query-client';

describe('tenantKey', () => {
  it('creates tenant-scoped key with parts', () => {
    expect(tenantKey('t1', 'data', 'list')).toEqual(['tenant', 't1', 'data', 'list']);
  });

  it('uses no-tenant fallback when tenantId is null', () => {
    expect(tenantKey(null, 'data')).toEqual(['tenant', 'no-tenant', 'data']);
  });

  it('handles undefined tenantId', () => {
    expect(tenantKey(undefined)).toEqual(['tenant', 'no-tenant']);
  });
});

describe('financialKey', () => {
  it('creates financial-scoped key with diagnosis and parts', () => {
    expect(financialKey('t1', 'd1', 'uploads')).toEqual([
      'tenant', 't1', 'financial', 'd1', 'uploads',
    ]);
  });

  it('uses fallbacks for null tenant and diagnosis', () => {
    expect(financialKey(null, null)).toEqual([
      'tenant', 'no-tenant', 'financial', 'no-diagnosis',
    ]);
  });

  it('handles no extra parts', () => {
    expect(financialKey('t1', 'd1')).toEqual([
      'tenant', 't1', 'financial', 'd1',
    ]);
  });
});

describe('assessmentKey', () => {
  it('creates assessment-scoped key', () => {
    expect(assessmentKey('t1', 'a1', 'scores')).toEqual([
      'tenant', 't1', 'assessment', 'a1', 'scores',
    ]);
  });

  it('uses fallbacks for null values', () => {
    expect(assessmentKey(null, null)).toEqual([
      'tenant', 'no-tenant', 'assessment', 'no-assessment',
    ]);
  });
});

describe('invalidateFinancialQueries', () => {
  it('is callable with queryClient and diagnosisId', async () => {
    await expect(
      invalidateFinancialQueries(queryClientInstance, 'test-diagnosis')
    ).resolves.toBeUndefined();
  });

  it('is callable with tenantId as third arg', async () => {
    await expect(
      invalidateFinancialQueries(queryClientInstance, 'test-diagnosis', 'test-tenant')
    ).resolves.toBeUndefined();
  });

  it('is callable with null diagnosisId', async () => {
    await expect(
      invalidateFinancialQueries(queryClientInstance, null, 'test-tenant')
    ).resolves.toBeUndefined();
  });
});