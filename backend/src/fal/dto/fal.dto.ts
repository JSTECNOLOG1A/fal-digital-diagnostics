import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

const DIAGNOSTIC_DEPTHS = ['rapid', 'standard', 'deep'];

/// Telas legadas (base44) costumam mandar '' em vez de omitir um campo
/// UUID opcional (ex.: FalAssessmentSetupPage manda `form.method_version_id
/// || methodVersion?.id || ''`) — sem isso, @IsOptional() não pega (só trata
/// undefined/null) e @IsUUID() rejeita a string vazia com 400.
const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

export class CreateAssessmentDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  methodVersionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  targetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assessmentType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['single_entity', 'fal_scoped', 'multi_entity_master'])
  assessmentMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  competence?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  cycleNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cycleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contextNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  penaltyProfileKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scopeMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recipientName?: string;

  @ApiPropertyOptional({ enum: DIAGNOSTIC_DEPTHS })
  @IsOptional()
  @IsIn(DIAGNOSTIC_DEPTHS)
  diagnosticDepth?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  activeDimensions?: string[];

  /// Vocabulário aberto herdado do base44 (draft, in_progress, scoring,
  /// completed, published, archived, ...) — sem whitelist fixa.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startedAt?: string;

  /// Cauda longa de campos legados sem coluna própria (ver schema.prisma).
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateAssessmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: DIAGNOSTIC_DEPTHS })
  @IsOptional()
  @IsIn(DIAGNOSTIC_DEPTHS)
  diagnosticDepth?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  activeDimensions?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  questionSet?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progressPercentage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastSavedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastSubdimensionKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contextNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recipientName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  completedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  methodVersionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  targetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cycleLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assessmentType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assessmentMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  competence?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  cycleNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cycleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  penaltyProfileKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scopeMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startedAt?: string;

  /// Cauda longa de campos legados — merge raso sobre o metadata existente
  /// (não substitui o objeto inteiro, senão uma tela desatualizada apagaria
  /// campos gravados por outra).
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ListAssessmentsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  targetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  includeArchived?: string;
}

export class ListFalQuestionsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dimensionKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clusterKey?: string;

  /** CSV de ids — usado pra hidratar o question_set congelado do assessment. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ids?: string;
}

export class CreateFalQuestionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  questionId!: string;

  @ApiProperty()
  @IsString()
  dimensionKey!: string;

  @ApiProperty()
  @IsString()
  subdimensionKey!: string;

  @ApiProperty()
  @IsString()
  clusterKey!: string;

  @ApiProperty()
  @IsString()
  processStage!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sequenceOrder?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  diagnosticDepth?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  levelApplicability?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  questionWeight?: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  questionText!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  guidance?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  evidenceHint?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isKillerQuestion?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isCritical?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dependency?: string;
}

export class UpsertFalResponseDto {
  @ApiProperty()
  @IsUUID()
  assessmentId!: string;

  @ApiProperty()
  @IsUUID()
  falQuestionId!: string;

  @ApiProperty()
  @IsString()
  dimensionKey!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subdimensionKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clusterKey?: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(3)
  score!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  justification?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  confidenceLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  flag?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  evidenceNotes?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceFileUrls?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  evaluatedEntityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  evaluatedEntityType?: string;
}

export class UpsertMQEResponseDto {
  @ApiProperty()
  @IsUUID()
  assessmentId!: string;

  @ApiProperty()
  @IsUUID()
  mqeQuestionId!: string;

  @ApiProperty()
  @IsString()
  crossingKey!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(3)
  score!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  justification?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  divergenceNotes?: string;
}

export class GenerateFalContentSuggestionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  clusterKey!: string;

  @ApiPropertyOptional({ enum: ['question', 'recommendation'] })
  @IsOptional()
  @IsIn(['question', 'recommendation'])
  contentType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  count?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  triggerScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requestedBy?: string;
}

export class ReviewFalContentSuggestionDto {
  @ApiProperty({ enum: ['approve', 'reject'] })
  @IsIn(['approve', 'reject'])
  action!: 'approve' | 'reject';

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  editedPayload?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}

export class BuildQuestionSetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  triggerGapDetection?: boolean;
}

export class PublishAssessmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cycleId?: string;
}

export class SwapFalQuestionDto {
  @ApiProperty()
  @IsString()
  originalQuestionId!: string;

  @ApiProperty()
  @IsString()
  swapReason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  swapReasonLabel?: string;
}
