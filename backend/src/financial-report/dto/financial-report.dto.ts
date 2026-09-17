import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

// ── Achados/Insights ────────────────────────────────────────────────────

export class GenerateFinancialFindingsDto {
  @ApiPropertyOptional()
  @IsUUID()
  financialDiagnosisId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['replace', 'append'])
  mode?: string;
}

const FINDING_MANAGE_ACTIONS = ['approve', 'edit', 'exclude', 'internal_only', 'unapprove', 'reopen', 'ignore'] as const;

export class ManageFinancialFindingDto {
  @ApiPropertyOptional({ enum: FINDING_MANAGE_ACTIONS })
  @IsIn(FINDING_MANAGE_ACTIONS)
  action!: (typeof FINDING_MANAGE_ACTIONS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  editedText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classification?: string;
}

export class CreateManualFinancialFindingDto {
  @ApiPropertyOptional()
  @IsUUID()
  financialDiagnosisId!: string;

  @ApiPropertyOptional()
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'critical'])
  severity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  period?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  evidenceNumeric?: Record<string, unknown>[];
}

// ── Recomendações ────────────────────────────────────────────────────────

export class GenerateFinancialRecommendationsDto {
  @ApiPropertyOptional()
  @IsUUID()
  financialDiagnosisId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['replace', 'append'])
  mode?: string;
}

export class UpdateFinancialRecommendationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  editableText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  consultantComment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['critica', 'alta', 'media', 'baixa'])
  priority?: string;
}

const RECOMMENDATION_MANAGE_ACTIONS = ['approve', 'edit', 'exclude', 'internal_only', 'unapprove'] as const;

/** Curadoria de inclusão na seção "4. Recomendações avulsas" do relatório — mesmo padrão de ManageFinancialFindingDto, mas edita os 3 campos estruturados (Tese/Ação/Impacto) em vez de um texto único. */
export class ManageFinancialRecommendationDto {
  @ApiPropertyOptional({ enum: RECOMMENDATION_MANAGE_ACTIONS })
  @IsIn(RECOMMENDATION_MANAGE_ACTIONS)
  action!: (typeof RECOMMENDATION_MANAGE_ACTIONS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  diagnosticThesis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  suggestedAction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expectedImpact?: string;
}

export class ConvertFinancialRecommendationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialRecommendationId?: string;

  /** Envio direto de um achado (FinancialFinding) ao Plano de Ação, sem
   * exigir uma FinancialRecommendation pré-existente — necessário pros
   * achados de cruzamento automático (sourceType 'cross_statement'), que
   * hoje não têm entrada em RECOMMENDATION_MAP e por isso nunca geram
   * recomendação pelo fluxo padrão (generateRecommendations). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialFindingId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  financialDiagnosisId!: string;

  @ApiPropertyOptional()
  @IsString()
  taskTitle!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['30d', '60d', '90d', '180d'])
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
  indicatorCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  indicatorLabel?: string;
}

export class UnconvertActionTaskDto {
  @ApiPropertyOptional()
  @IsUUID()
  actionTaskId!: string;

  @ApiPropertyOptional()
  @IsUUID()
  financialDiagnosisId!: string;
}

// ── Versões de relatório ────────────────────────────────────────────────

export class CreateFinancialReportVersionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialDiagnosisId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  overwriteReviewedText?: boolean;
}

export class FinalizeFinancialReportVersionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateFinancialReportTextDto {
  @ApiPropertyOptional()
  @IsString()
  sectionKey!: string;

  @ApiPropertyOptional()
  @IsString()
  text!: string;
}
