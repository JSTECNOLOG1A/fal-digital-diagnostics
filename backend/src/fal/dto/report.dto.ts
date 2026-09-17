import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

const REPORT_TYPES = [
  'initial_diagnostic',
  'approved_action_plan',
  'review_cycle',
  'consolidated_evolution',
  'executive_summary',
  'action_scope',
  'financial_diagnostic',
  'synthetic_integrated',
  'custom',
] as const;

export class GenerateReportVersionDto {
  @ApiPropertyOptional()
  @IsUUID()
  assessmentId!: string;

  @ApiPropertyOptional({ enum: REPORT_TYPES })
  @IsIn(REPORT_TYPES)
  reportType!: (typeof REPORT_TYPES)[number];

  @ApiPropertyOptional()
  @IsNotEmpty()
  reportTitle!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  presetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  reportParameters?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  actionPlanReviewId?: string;
}

export class BeginPdfArtifactDto {
  @ApiPropertyOptional()
  @IsUUID()
  reportVersionId!: string;
}

export class CommitPdfArtifactDto {
  @ApiPropertyOptional()
  @IsUUID()
  reportVersionId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pdfStatus?: 'failed';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pdfError?: string;

  @ApiPropertyOptional()
  @IsNotEmpty()
  pdfOperationId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pdfFileUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pdfUploadIdentifier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  pdfPageCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  pdfFileSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pdfChecksum?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payloadChecksum?: string;
}

export class ArchiveReportVersionDto {
  @ApiPropertyOptional()
  @IsUUID()
  reportVersionId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  replacementReportVersionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
