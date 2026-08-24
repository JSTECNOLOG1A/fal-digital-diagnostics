export const phase4Functions = new Set([
  'generateActionPlan','recalculateActionPlanState','updateActionTaskWithHistory','createManualActionTask','convertFinancialRecommendation','manageActionRecommendation','sendFindingToActionPlan','generateActionRecommendations','deduplicateActionRecommendations','createActionPlanReviewWithSnapshot','completeActionPlanReview','cancelActionPlanReview','deduplicateActionPlanReviews','generateAssessmentReportVersion','setOfficialAssessmentReportVersion','archiveReportVersion','beginReportPdfArtifact','commitReportPdfArtifact','cleanupPdfArtifactOrphan',
]);
export const phase4WriterContracts = {
  generateActionPlan: { ActionPlan:['create','update'], ActionTask:['create','update'], ActionRecommendation:['update'], AssessmentFlowState:['create','update'], ActionPlanGenerationOperation:['create','update'] },
  recalculateActionPlanState: { ActionPlan:['update'] },
  updateActionTaskWithHistory: { ActionTask:['update'], ActionTaskActivity:['create','update'], ActionTaskReview:['create','update'], ActionPlan:['update'] },
  createManualActionTask: { ActionTask:['create','update'], ActionTaskActivity:['create','update'], ActionPlan:['update'] },
  convertFinancialRecommendation: { ActionTask:['create'], ActionRecommendation:['update'], ActionPlan:['create','update'], FinancialRecommendation:['update'] },
  manageActionRecommendation: { ActionRecommendation:['create','update'], ActionTask:['create'], ActionPlan:['create'], FinancialFinding:['update'], ActionRecommendationLibrary:['create'] },
  sendFindingToActionPlan: { ActionRecommendation:['create','update'], ActionTask:['create'], ActionPlan:['create','update'], FinancialFinding:['update'] },
  generateActionRecommendations: { ActionRecommendation:['create','update'] },
  deduplicateActionRecommendations: { ActionRecommendation:['delete','update'] },
  createActionPlanReviewWithSnapshot: { ActionPlanReview:['create','update'], ActionPlan:['update'], ActionTaskReview:['create','update'] },
  completeActionPlanReview: { ActionPlanReview:['update'], ActionPlan:['update'], ActionTaskReview:['update'], ActionTask:['update'] },
  cancelActionPlanReview: { ActionPlanReview:['update'], ActionPlan:['update'], ActionTaskReview:['update'] },
  deduplicateActionPlanReviews: { ActionPlanReview:['update','delete'], ActionTaskReview:['update','delete'] },
  generateAssessmentReportVersion: { AssessmentReportVersion:['create','update'] },
  setOfficialAssessmentReportVersion: { AssessmentReportVersion:['update'] },
  archiveReportVersion: { AssessmentReportVersion:['update'] },
  beginReportPdfArtifact: { AssessmentReportVersion:['update'] },
  commitReportPdfArtifact: { AssessmentReportVersion:['update'] },
  cleanupPdfArtifactOrphan: { PdfArtifactOrphan:['create','update','delete'] },
};