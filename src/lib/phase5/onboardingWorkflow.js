export const onboardingOperations = { tenant: 'create_group', group: 'create_group', company: 'create_company', unit: 'create_unit', diagnostic: 'create_assessment' };
export function onboardingDestination(progress, assessmentId) {
  if (progress?.status !== 'completed' || !progress.group_id || !assessmentId) return null;
  return `/GroupDetail?id=${progress.group_id}&tab=diagnostico-8d&assessment_id=${assessmentId}`;
}
export function canCompleteOnboarding(progress, assessmentId) {
  return Boolean(progress?.group_id && progress?.company_id && assessmentId);
}