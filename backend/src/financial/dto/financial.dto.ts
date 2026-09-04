import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * data_base_abertura/data_base_fechamento chegam do frontend como "MM/AAAA"
 * (ex: "12/2023"), não como data ISO completa — é o formato que o
 * FinancialDefinitionForm usa para essas duas colunas. Aceitamos esse
 * formato aqui; a conversão para Date (dia 1 do mês) acontece no service.
 */
const MONTH_YEAR_REGEX = /^(0[1-9]|1[0-2])\/\d{4}$/;

// ── Plano de contas financeiro ─────────────────────────────────────────

export class CreateFinancialAccountPlanDto {
  @ApiProperty()
  @IsUUID()
  groupId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  version?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class UpdateFinancialAccountPlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  version?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  /** Compat UI Base44: true = soft-delete / arquivar */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}

// ── Linhas do plano de contas ──────────────────────────────────────────

/** Campos de negócio de uma linha — reaproveitado por create/update/bulk. */
export class FinancialAccountPlanLineFieldsDto {
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  accountCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountCodeDisplay?: string;

  @ApiProperty()
  @IsString()
  accountName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentAccountCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classification?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  statementCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bpGroup?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ebitdaComponent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  canonicalKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dfcClassification?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  statementGroup?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateFinancialAccountPlanLineDto extends FinancialAccountPlanLineFieldsDto {
  @ApiProperty()
  @IsUUID()
  accountPlanId!: string;
}

export class UpdateFinancialAccountPlanLineDto {
  @ApiPropertyOptional() @IsOptional() @IsString() accountCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() accountCodeDisplay?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() accountName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() accountType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() parentAccountCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() classification?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() statementCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bpGroup?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ebitdaComponent?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() canonicalKey?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dfcClassification?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() statementGroup?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class BulkCreateFinancialAccountPlanLinesDto {
  @ApiProperty()
  @IsUUID()
  accountPlanId!: string;

  @ApiProperty({ type: [FinancialAccountPlanLineFieldsDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FinancialAccountPlanLineFieldsDto)
  lines!: FinancialAccountPlanLineFieldsDto[];

  /** Se true, apaga as linhas atuais do plano antes de inserir as novas. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  replace?: boolean;
}

// ── Diagnóstico financeiro ─────────────────────────────────────────────

export class CreateFinancialDiagnosisDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['group', 'company', 'unit'])
  scopeLevel?: string;

  @ApiPropertyOptional({ description: "Fase 1 só suporta 'individual'." })
  @IsOptional()
  @IsIn(['individual', 'combined', 'consolidated'])
  analysisType?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstPeriod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastPeriod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['mensal', 'trimestral', 'anual'])
  periodicidade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  accountPlanId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Formato MM/AAAA, ex: 12/2023.' })
  @IsOptional()
  @Matches(MONTH_YEAR_REGEX, { message: 'dataBaseAbertura deve estar no formato MM/AAAA' })
  dataBaseAbertura?: string;

  @ApiPropertyOptional({ description: 'Formato MM/AAAA, ex: 12/2024.' })
  @IsOptional()
  @Matches(MONTH_YEAR_REGEX, { message: 'dataBaseFechamento deve estar no formato MM/AAAA' })
  dataBaseFechamento?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  monthsCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class UpdateFinancialDiagnosisDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() firstPeriod?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastPeriod?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['mensal', 'trimestral', 'anual']) periodicidade?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() accountPlanId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(MONTH_YEAR_REGEX, { message: 'dataBaseAbertura deve estar no formato MM/AAAA' }) dataBaseAbertura?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(MONTH_YEAR_REGEX, { message: 'dataBaseFechamento deve estar no formato MM/AAAA' }) dataBaseFechamento?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() monthsCount?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() currentUploadId?: string;

  /** Compat UI Base44: true = soft-delete / arquivar */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}

// ── Upload de balancete ────────────────────────────────────────────────

export class CreateFinancialUploadMetaDto {
  @ApiProperty()
  @IsUUID()
  financialDiagnosisId!: string;

  @ApiProperty({ description: 'Chave do objeto retornada por POST /financial/uploads/storage.' })
  @IsString()
  @IsNotEmpty()
  fileUrl!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  versionNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  replacementStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  inputChecksum?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sourceEntityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceEntityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceEntityName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourcePeriod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateFinancialUploadDto {
  @ApiPropertyOptional() @IsOptional() @IsString() sourcePeriod?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isCurrent?: boolean;
}

// ── Jornada ─────────────────────────────────────────────────────────────

export class UpdateJourneyPositionDto {
  @ApiProperty()
  @IsUUID()
  financialDiagnosisId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  step!: string;
}

export class ValidateUploadDto {
  @ApiProperty()
  @IsUUID()
  uploadId!: string;

  @ApiProperty()
  @IsUUID()
  diagnosisId!: string;
}

export class PurgeFinancialDiagnosisDto {
  @ApiProperty()
  @IsUUID()
  diagnosisId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}

export class PurgeFinancialUploadDerivedDto {
  @ApiProperty()
  @IsUUID()
  uploadId!: string;

  @ApiProperty()
  @IsUUID()
  diagnosisId!: string;
}

export class DeleteFinancialUploadSafeDto {
  @ApiProperty()
  @IsUUID()
  financialDiagnosisId!: string;

  @ApiProperty()
  @IsUUID()
  financialUploadId!: string;
}

export class BuildFinancialStatementsDto {
  @ApiProperty()
  @IsUUID()
  uploadId!: string;

  @ApiProperty()
  @IsUUID()
  diagnosisId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  periodOverride?: string | null;
}

export class JourneyStateQueryDto {
  @ApiProperty()
  @IsUUID()
  financialDiagnosisId!: string;
}

// ── Ajuste manual de DFC ────────────────────────────────────────────────

export class CreateDfcManualAdjustmentDto {
  @ApiProperty()
  @IsUUID()
  financialDiagnosisId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialUploadId?: string | null;

  @ApiProperty()
  @IsIn(['operating', 'investing', 'financing'])
  activity!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label!: string;

  @ApiProperty()
  @IsNumber()
  value!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  period!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  columnKey?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adjustmentType?: string | null;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  justification!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class UpdateDfcManualAdjustmentDto {
  @ApiProperty()
  @IsUUID()
  financialDiagnosisId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['operating', 'investing', 'financing'])
  activity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  value?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  period?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  columnKey?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adjustmentType?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  justification?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;
}
