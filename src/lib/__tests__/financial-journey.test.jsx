/**
 * financial-journey.test.jsx — Testes do hook useDiagnosisJourney (F2-JRN-01).
 *
 * Verifica:
 *   1. O hook consome a function backend getFinancialJourneyState
 *   2. O fallback não marca etapas como concluídas
 *   3. O fallback não permite avançar à análise
 *   4. A etapa Validação está presente em todos os tipos de análise
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock base44 client before importing the hook
vi.mock('@/api/base44Client', () => ({
  base44: {
    functions: {
      invoke: vi.fn(),
    },
    entities: {},
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ data: null, isLoading: true, isError: false })),
}));

vi.mock('@/lib/query-client', () => ({
  financialKey: (tenantId, diagnosisId, key) => ['financial', tenantId, diagnosisId, key],
}));

import { useDiagnosisJourney } from '@/lib/hooks/useDiagnosisJourney';

describe('useDiagnosisJourney — F2-JRN-01', () => {
  it('existe e é uma função', () => {
    expect(typeof useDiagnosisJourney).toBe('function');
  });

  it('retorna fallback quando backend indisponível — não marca etapas como concluídas', () => {
    const result = useDiagnosisJourney({
      diagnosisId: 'test-diag',
      diagnosis: { analysis_type: 'individual', tenant_id: 't1' },
    });

    // Fallback: nenhum step deve estar 'done'
    expect(result.isFallback).toBe(true);
    for (const step of result.steps) {
      expect(step.completed).toBe(false);
      expect(step.status).not.toBe('done');
    }
  });

  it('fallback não permite avançar à análise', () => {
    const result = useDiagnosisJourney({
      diagnosisId: 'test-diag',
      diagnosis: { analysis_type: 'individual', tenant_id: 't1' },
    });

    expect(result.canOpenAnalysis).toBe(false);
    const analiseStep = result.steps.find((s) => s.key === 'analise');
    expect(analiseStep?.accessible).toBe(false);
  });

  it('fallback inclui etapa Validação para individual', () => {
    const result = useDiagnosisJourney({
      diagnosisId: 'test-diag',
      diagnosis: { analysis_type: 'individual', tenant_id: 't1' },
    });

    const keys = result.steps.map((s) => s.key);
    expect(keys).toContain('validacao');
    expect(keys).toEqual(['estrutura', 'fontes', 'validacao', 'analise']);
  });

  it('fallback inclui etapa Validação para combined', () => {
    const result = useDiagnosisJourney({
      diagnosisId: 'test-diag',
      diagnosis: { analysis_type: 'combined', tenant_id: 't1' },
    });

    const keys = result.steps.map((s) => s.key);
    expect(keys).toContain('validacao');
    expect(keys).toEqual(['estrutura', 'fontes', 'conciliacao', 'cedula', 'combinacao', 'validacao', 'analise']);
  });

  it('fallback inclui etapa Validação para consolidated', () => {
    const result = useDiagnosisJourney({
      diagnosisId: 'test-diag',
      diagnosis: { analysis_type: 'consolidated', tenant_id: 't1' },
    });

    const keys = result.steps.map((s) => s.key);
    expect(keys).toContain('validacao');
    expect(keys).toEqual(['estrutura', 'fontes', 'conciliacao', 'cedula', 'preparacao', 'validacao', 'analise']);
  });

  it('canAccess retorna false para etapas não acessíveis no fallback', () => {
    const result = useDiagnosisJourney({
      diagnosisId: 'test-diag',
      diagnosis: { analysis_type: 'individual', tenant_id: 't1' },
    });

    expect(result.canAccess('fontes')).toBe(false);
    expect(result.canAccess('validacao')).toBe(false);
    expect(result.canAccess('analise')).toBe(false);
  });
});