import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../storage/storage.module';
import { AssessmentController } from './assessment.controller';
import { AssessmentService } from './assessment.service';
import { FalQuestionController } from './fal-question.controller';
import { FalQuestionService } from './fal-question.service';
import { FalResponseController } from './fal-response.controller';
import { FalResponseService } from './fal-response.service';
import { MqeController } from './mqe.controller';
import { MqeService } from './mqe.service';
import { FalContentSuggestionController } from './fal-content-suggestion.controller';
import { FalContentSuggestionService } from './fal-content-suggestion.service';
import { MethodVersionController } from './method-version.controller';
import { MethodVersionService } from './method-version.service';
import { AssessmentFlowController } from './assessment-flow.controller';
import { AssessmentFlowService } from './assessment-flow.service';
import { FalDiagnosticController } from './fal-diagnostic.controller';
import { FalDiagnosticService } from './fal-diagnostic.service';
import { MfisController } from './mfis.controller';
import { MfisService } from './mfis.service';
import { FalAggregateController } from './fal-aggregate.controller';
import { FalAggregateService } from './fal-aggregate.service';
import { FalReadController } from './fal-read.controller';
import { FalReadService } from './fal-read.service';
import { ActionPlanController } from './action-plan.controller';
import { ActionPlanService } from './action-plan.service';
import { ActionTaskController } from './action-task.controller';
import { ActionTaskService } from './action-task.service';
import { ActionRecommendationController } from './action-recommendation.controller';
import { ActionRecommendationService } from './action-recommendation.service';
import { ActionPlanReviewController } from './action-plan-review.controller';
import { ActionPlanReviewService } from './action-plan-review.service';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { AssessmentScopeController } from './assessment-scope.controller';
import { AssessmentScopeService } from './assessment-scope.service';
import { FalQuestionSwapController } from './fal-question-swap.controller';
import { FalQuestionSwapService } from './fal-question-swap.service';

@Module({
  imports: [AuditModule, StorageModule],
  controllers: [
    AssessmentController,
    FalQuestionController,
    FalResponseController,
    MqeController,
    FalContentSuggestionController,
    MethodVersionController,
    AssessmentFlowController,
    FalDiagnosticController,
    MfisController,
    FalAggregateController,
    FalReadController,
    ActionPlanController,
    ActionTaskController,
    ActionRecommendationController,
    ActionPlanReviewController,
    ReportController,
    AssessmentScopeController,
    FalQuestionSwapController,
  ],
  providers: [
    AssessmentService,
    FalQuestionService,
    FalResponseService,
    MqeService,
    FalContentSuggestionService,
    MethodVersionService,
    AssessmentFlowService,
    FalDiagnosticService,
    MfisService,
    FalAggregateService,
    FalReadService,
    ActionPlanService,
    ActionTaskService,
    ActionRecommendationService,
    ActionPlanReviewService,
    ReportService,
    AssessmentScopeService,
    FalQuestionSwapService,
  ],
  exports: [AssessmentService, ActionPlanService],
})
export class FalModule {}
