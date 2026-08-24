export function createPhase4ProductiveFixture({ tenantId = 'tenant-f4', assessmentId = 'assessment-f4', targetId = 'company-f4', cycleId = 'cycle-f4', includeFinancial = true, includeRecommendation = true, includeSecondPageRecord = false } = {}) {
  const recommendation = { id: 'recommendation-1', tenant_id: tenantId, assessment_id: assessmentId, status: 'approved', title: 'Implantar reunião mensal', recommendation_text: 'Criar rito mensal.', dimension_key: 'governanca', subdimension_key: 'ritos_governanca', cluster_key: 'cluster-governanca-1', impact_score: 5, effort_score: 1, approved_at: '2026-07-20T10:30:00.000Z', created_date: '2026-07-20T10:30:00.000Z' };
  const seed = {
    Assessment: [{ id: assessmentId, tenant_id: tenantId, target_type: 'company', target_id: targetId, cycle_id: cycleId, sector_snapshot: ['agribusiness'], method_version_id: 'fal-method-1', question_set: ['question-1'], status: 'published' }],
    FalDiagnosticSnapshot: [{ id: 'diagnostic-snapshot-1', tenant_id: tenantId, assessment_id: assessmentId, cycle_id: cycleId, checksum: 'diagnostic-checksum-1', computed_at: '2026-07-20T10:00:00.000Z', question_set: ['question-1'], dimension_scores: { governanca: { active: true, score: 1.2, subdimension_scores: { ritos_governanca: { score: 1.2, cluster_scores: { 'cluster-governanca-1': { score: 1 } } } } } } }],
    FalInsightSnapshot: [{ id: 'insight-snapshot-1', tenant_id: tenantId, assessment_id: assessmentId, cycle_id: cycleId, checksum: 'insight-checksum-1', computed_at: '2026-07-20T10:01:00.000Z', root_causes_ranked: [], driver_scores: {} }],
    FalResponse: [{ id: 'response-1', assessment_id: assessmentId, fal_question_id: 'question-1', score: 1 }],
    FalQuestion: [{ id: 'question-1', dimension_key: 'governanca', cluster_key: 'cluster-governanca-1', is_killer_question: false }],
    FalActionLibrary: [], FalRecommendationLibrary: [], FalQuestionActionLibrary: [], FalRootCauseCatalog: [],
    ActionRecommendation: includeRecommendation ? [recommendation] : [], ActionPlan: [], ActionTask: [], ActionTaskActivity: [], ActionTaskReview: [], ActionPlanReview: [],
    AssessmentFlowState: [{ id: 'flow-1', assessment_id: assessmentId, action_plan_status: 'pending' }],
    DiagnosticLink: [], FinancialDiagnosis: [], FinancialSourceOutputHead: [], FinancialProcessingSnapshot: [], AssessmentReportVersion: [],
  };
  if (includeFinancial) {
    seed.DiagnosticLink.push({ id: 'link-1', tenant_id: tenantId, fal_assessment_id: assessmentId, financial_diagnosis_id: 'financial-diagnosis-1', status: 'active' });
    seed.FinancialDiagnosis.push({ id: 'financial-diagnosis-1', tenant_id: tenantId, analysis_type: 'individual', current_processing_snapshot_id: 'financial-snapshot-1' });
    seed.FinancialProcessingSnapshot.push({ id: 'financial-snapshot-1', tenant_id: tenantId, financial_processing_run_id: 'financial-run-1', output_checksum: 'financial-output-checksum-1', status: 'active', period: '2025' });
  }
  if (includeSecondPageRecord) seed.ActionRecommendation = Array.from({ length: 501 }, (_, index) => index === 500 ? recommendation : ({ ...recommendation, id: `noise-${String(index).padStart(3, '0')}`, status: 'dismissed', title: `Noise ${index}` }));
  return { seed, user: { email: 'consultant@fal.test', tenant_id: tenantId, app_role: 'consultant' }, recommendation };
}