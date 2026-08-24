import { describe, expect, it } from 'vitest';
import { onboardingDestination } from '@/lib/phase5/onboardingWorkflow';

describe('phase5 official UI states', () => {
  it('keeps a tenant without a completed assessment in onboarding', () => expect(onboardingDestination({ status: 'active', group_id: 'g1' }, 'a1')).toBeNull());
  it('never treats navigation alone as diagnostic creation', () => expect(onboardingDestination({ status: 'completed', group_id: 'g1' }, null)).toBeNull());
});