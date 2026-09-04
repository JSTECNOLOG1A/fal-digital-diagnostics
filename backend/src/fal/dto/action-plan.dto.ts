import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class GenerateActionPlanDto {
  @ApiPropertyOptional()
  @IsUUID()
  assessmentId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cycleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  maxTasks?: number;

  @ApiPropertyOptional()
  @IsOptional()
  scoreThreshold?: number;
}

export class ListActionPlansQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assessmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetId?: string;
}

export class CreateManualActionTaskDto {
  @ApiPropertyOptional()
  @IsUUID()
  planId!: string;

  @ApiPropertyOptional()
  @IsObject()
  task!: Record<string, unknown>;
}

export class UpdateActionTaskWithHistoryDto {
  @ApiPropertyOptional()
  @IsUUID()
  taskId!: string;

  @ApiPropertyOptional()
  @IsObject()
  updates!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  reviewId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  overrideJustification?: string;
}

export class GenerateActionRecommendationsDto {
  @ApiPropertyOptional()
  @IsUUID()
  assessmentId!: string;

  @ApiPropertyOptional()
  @IsUUID()
  actionPlanId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['library_plus_ai', 'library_only'])
  mode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  scope?: { dimensions?: string[] };
}

const RECOMMENDATION_ACTIONS = [
  'create_manual',
  'link_cluster',
  'edit',
  'approve',
  'reject',
  'convert',
  'improve_ai',
  'suggest_library',
] as const;

export class ManageActionRecommendationDto {
  @ApiPropertyOptional({ enum: RECOMMENDATION_ACTIONS })
  @IsIn(RECOMMENDATION_ACTIONS)
  action!: (typeof RECOMMENDATION_ACTIONS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  recommendationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  recommendationData?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  editData?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clusterKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subdimensionKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rejectedReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  planId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taskTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  horizon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  evidenceRequired?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expectedResult?: string;
}

export class OpenActionPlanReviewDto {
  @ApiPropertyOptional()
  @IsUUID()
  actionPlanId!: string;

  @ApiPropertyOptional()
  @IsNotEmpty()
  reviewDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['intermediate', 'final', 'extraordinary'])
  visitType?: string;
}

export class CompleteActionPlanReviewDto {
  @ApiPropertyOptional()
  @IsUUID()
  reviewId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  executiveSummary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  decisions?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nextReviewDate?: string;
}

export class CancelActionPlanReviewDto {
  @ApiPropertyOptional()
  @IsUUID()
  reviewId!: string;

  @ApiPropertyOptional()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional()
  confirmLiveChanges!: boolean;
}
