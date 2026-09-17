import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AuthUser } from '../auth/auth.types';
import { FinancialOutputService } from './financial-output.service';

/**
 * Leitura dos outputs de buildFinancialStatements — o que o frontend lê via
 * base44.entities.FinancialStatementLine/FinancialIndicatorSnapshot/
 * FinancialDfcCompositionLine/FinancialMappingResolution.filter(...) e via
 * resolveCurrentFinancialOutputScope(). Todos autenticados, sem @Roles()
 * extra (mesmo padrão de leitura aberta a qualquer papel usado em
 * getDiagnosis/listPlans etc. — RolesGuard só bloqueia quando há @Roles()).
 */
@ApiTags('financial')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('financial')
export class FinancialOutputController {
  constructor(private readonly output: FinancialOutputService) {}

  @Get('output-scope')
  resolveOutputScope(@CurrentUser() user: AuthUser, @Query('financialDiagnosisId') financialDiagnosisId: string) {
    return this.output.resolveOutputScope(user, financialDiagnosisId);
  }

  @Get('integrity-check')
  checkIntegrity(@CurrentUser() user: AuthUser, @Query('financialDiagnosisId') financialDiagnosisId: string) {
    return this.output.checkIntegrity(user, financialDiagnosisId);
  }

  @Get('statement-lines')
  listStatementLines(
    @CurrentUser() user: AuthUser,
    @Query('financialDiagnosisId') financialDiagnosisId: string,
    @Query('financialUploadId') financialUploadId?: string,
    @Query('processingRunId') processingRunId?: string,
    @Query('publicationStatus') publicationStatus?: string,
  ) {
    return this.output.listStatementLines(user, financialDiagnosisId, {
      uploadId: financialUploadId,
      processingRunId,
      publicationStatus,
    });
  }

  @Get('indicator-snapshots')
  listIndicatorSnapshots(
    @CurrentUser() user: AuthUser,
    @Query('financialDiagnosisId') financialDiagnosisId: string,
    @Query('processingRunId') processingRunId?: string,
    @Query('publicationStatus') publicationStatus?: string,
    @Query('indicatorCode') indicatorCode?: string,
  ) {
    return this.output.listIndicatorSnapshots(user, financialDiagnosisId, {
      processingRunId,
      publicationStatus,
      indicatorCode,
    });
  }

  @Get('dfc-composition-lines')
  listDfcCompositionLines(
    @CurrentUser() user: AuthUser,
    @Query('financialDiagnosisId') financialDiagnosisId: string,
    @Query('processingRunId') processingRunId?: string,
    @Query('publicationStatus') publicationStatus?: string,
  ) {
    return this.output.listDfcCompositionLines(user, financialDiagnosisId, {
      processingRunId,
      publicationStatus,
    });
  }

  @Get('mapping-resolutions')
  listMappingResolutions(
    @CurrentUser() user: AuthUser,
    @Query('financialDiagnosisId') financialDiagnosisId: string,
    @Query('financialUploadId') financialUploadId?: string,
    @Query('processingRunId') processingRunId?: string,
    @Query('publicationStatus') publicationStatus?: string,
  ) {
    return this.output.listMappingResolutions(user, financialDiagnosisId, {
      uploadId: financialUploadId,
      processingRunId,
      publicationStatus,
    });
  }

  @Get('dfc-classification-overrides')
  listDfcClassificationOverrides(
    @CurrentUser() user: AuthUser,
    @Query('financialDiagnosisId') financialDiagnosisId: string,
  ) {
    return this.output.listDfcClassificationOverrides(user, financialDiagnosisId);
  }

  @Get('dfc-manual-adjustments')
  listDfcManualAdjustments(
    @CurrentUser() user: AuthUser,
    @Query('financialDiagnosisId') financialDiagnosisId: string,
  ) {
    return this.output.listDfcManualAdjustments(user, financialDiagnosisId);
  }

  @Get('processing-runs')
  listProcessingRuns(
    @CurrentUser() user: AuthUser,
    @Query('financialDiagnosisId') financialDiagnosisId: string,
  ) {
    return this.output.listProcessingRuns(user, financialDiagnosisId);
  }
}
