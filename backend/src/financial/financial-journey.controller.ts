import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AuthUser } from '../auth/auth.types';
import { FinancialJourneyService } from './financial-journey.service';
import { FinancialValidationService } from './financial-validation.service';
import { FinancialStatementsService } from './financial-statements.service';
import {
  BuildFinancialStatementsDto,
  CreateDfcManualAdjustmentDto,
  UpdateDfcManualAdjustmentDto,
  UpdateJourneyPositionDto,
  ValidateUploadDto,
} from './dto/financial.dto';

@ApiTags('financial')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('financial')
export class FinancialJourneyController {
  constructor(
    private readonly journey: FinancialJourneyService,
    private readonly validation: FinancialValidationService,
    private readonly statements: FinancialStatementsService,
  ) {}

  @Get('journey-state')
  getState(@CurrentUser() user: AuthUser, @Query('financialDiagnosisId') financialDiagnosisId: string) {
    return this.journey.getState(user, financialDiagnosisId);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('journey-position')
  updatePosition(@CurrentUser() user: AuthUser, @Body() dto: UpdateJourneyPositionDto) {
    return this.journey.updatePosition(user, dto.financialDiagnosisId, dto.step);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('validate-upload')
  validateUpload(@CurrentUser() user: AuthUser, @Body() dto: ValidateUploadDto) {
    return this.validation.validateUpload(user, dto.uploadId, dto.diagnosisId);
  }

  /**
   * Equivalente ao invoke('buildFinancialStatements', {upload_id, diagnosis_id, period_override})
   * do frontend — só o ramo "parse do Excel de um upload" (analysisType='individual').
   */
  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('build-statements')
  buildStatements(@CurrentUser() user: AuthUser, @Body() dto: BuildFinancialStatementsDto) {
    return this.statements.build(user, dto.uploadId, dto.diagnosisId, dto.periodOverride ?? null);
  }

  /**
   * CRUD de ajuste manual de DFC + recálculo automático ("dfc_only") logo
   * em seguida — equivalente ao invoke('manageDfcManualAdjustment', ...)
   * do frontend (base44/functions/manageDfcManualAdjustment/entry.ts).
   */
  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('dfc-manual-adjustments')
  createDfcManualAdjustment(@CurrentUser() user: AuthUser, @Body() dto: CreateDfcManualAdjustmentDto) {
    return this.statements.createDfcManualAdjustment(user, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Patch('dfc-manual-adjustments/:id')
  updateDfcManualAdjustment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateDfcManualAdjustmentDto,
  ) {
    return this.statements.updateDfcManualAdjustment(user, id, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Delete('dfc-manual-adjustments/:id')
  deleteDfcManualAdjustment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('financialDiagnosisId') financialDiagnosisId: string,
  ) {
    return this.statements.deleteDfcManualAdjustment(user, id, financialDiagnosisId);
  }
}
