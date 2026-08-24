import { describe, expect, it } from 'vitest';
import { canCompleteOnboarding, onboardingDestination, onboardingOperations } from '@/lib/phase5/onboardingWorkflow';

describe('phase5 onboarding contract', () => {
  it('requires a real assessment before completion and routes to diagnostic 8D', () => {
    const progress = { status: 'completed', group_id: 'group-1', company_id: 'company-1' };
    expect(canCompleteOnboarding(progress, null)).toBe(false);
    expect(canCompleteOnboarding(progress, 'assessment-1')).toBe(true);
    expect(onboardingDestination(progress, 'assessment-1')).toContain('assessment_id=assessment-1');
  });
  it('maps the diagnostic step to real assessment creation', () => expect(onboardingOperations.diagnostic).toBe('create_assessment'));
});