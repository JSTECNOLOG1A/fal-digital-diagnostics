import { describe, expect, it } from 'vitest';
import { computeNextMovement } from '@/lib/group/nextMovementEngine';

const ctx = (overrides = {}) => ({ assessment: null, falSnap: null, hasFinancial: false, plan: null, criticalOpen: 0, openTasks: 0, hasReviews: false, hasReport: false, onGoTo: () => {}, createPageUrl: (path) => `/${path}`, ...overrides });

describe('F5-UX-01 cockpit journey', () => {
  it('uses one deterministic next movement for the documented journey', () => {
    expect(computeNextMovement(ctx()).label).toBe('Iniciar Diagnóstico 8D');
    expect(computeNextMovement(ctx({ assessment: { id: 'a1', status: 'in_progress', progress_percentage: 30 } })).label).toBe('Continuar Diagnóstico 8D');
    expect(computeNextMovement(ctx({ assessment: { id: 'a1', status: 'published', progress_percentage: 100 }, hasFinancial: true, plan: { id: 'p1' }, hasReviews: true, hasReport: true })).label).toBe('Acompanhar Evolução');
  });
});