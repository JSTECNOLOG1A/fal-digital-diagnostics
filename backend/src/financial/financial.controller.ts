import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AuthUser } from '../auth/auth.types';
import { FinancialDiagnosisService } from './financial-diagnosis.service';
import { FinancialAccountPlanService } from './financial-account-plan.service';
import {
  BulkCreateFinancialAccountPlanLinesDto,
  CreateFinancialAccountPlanDto,
  CreateFinancialAccountPlanLineDto,
  CreateFinancialDiagnosisDto,
  UpdateFinancialAccountPlanDto,
  UpdateFinancialAccountPlanLineDto,
  UpdateFinancialDiagnosisDto,
} from './dto/financial.dto';

@ApiTags('financial')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('financial')
export class FinancialController {
  constructor(
    private readonly diagnoses: FinancialDiagnosisService,
    private readonly plans: FinancialAccountPlanService,
  ) {}

  // ── Diagnósticos ──────────────────────────────────────────────────

  @Get('diagnoses')
  listDiagnoses(
    @CurrentUser() user: AuthUser,
    @Query('groupId') groupId?: string,
    @Query('companyId') companyId?: string,
    @Query('unitId') unitId?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.diagnoses.list(user, {
      groupId,
      companyId,
      unitId,
      includeArchived: includeArchived === 'true' || includeArchived === '1',
    });
  }

  @Get('diagnoses/:id')
  getDiagnosis(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.diagnoses.get(user, id);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('diagnoses')
  createDiagnosis(@CurrentUser() user: AuthUser, @Body() dto: CreateFinancialDiagnosisDto) {
    return this.diagnoses.create(user, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Patch('diagnoses/:id')
  updateDiagnosis(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateFinancialDiagnosisDto,
  ) {
    return this.diagnoses.update(user, id, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN)
  @Delete('diagnoses/:id')
  deleteDiagnosis(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.diagnoses.delete(user, id);
  }

  // ── Planos de contas ──────────────────────────────────────────────

  @Get('account-plans')
  listPlans(
    @CurrentUser() user: AuthUser,
    @Query('groupId') groupId?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.plans.listPlans(user, groupId, includeArchived === 'true' || includeArchived === '1');
  }

  @Get('account-plans/:id')
  getPlan(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.plans.getPlan(user, id);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('account-plans')
  createPlan(@CurrentUser() user: AuthUser, @Body() dto: CreateFinancialAccountPlanDto) {
    return this.plans.createPlan(user, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Patch('account-plans/:id')
  updatePlan(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateFinancialAccountPlanDto,
  ) {
    return this.plans.updatePlan(user, id, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN)
  @Delete('account-plans/:id')
  deletePlan(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.plans.deletePlan(user, id);
  }

  // ── Linhas do plano de contas ─────────────────────────────────────

  @Get('account-plans/:id/lines')
  listLines(@CurrentUser() user: AuthUser, @Param('id') accountPlanId: string) {
    return this.plans.listLines(user, accountPlanId);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Delete('account-plans/:id/lines')
  deleteAllLines(@CurrentUser() user: AuthUser, @Param('id') accountPlanId: string) {
    return this.plans.deleteAllLines(user, accountPlanId);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('account-plan-lines')
  createLine(@CurrentUser() user: AuthUser, @Body() dto: CreateFinancialAccountPlanLineDto) {
    return this.plans.createLine(user, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('account-plan-lines/bulk')
  bulkCreateLines(@CurrentUser() user: AuthUser, @Body() dto: BulkCreateFinancialAccountPlanLinesDto) {
    return this.plans.bulkCreateLines(user, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Patch('account-plan-lines/:id')
  updateLine(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateFinancialAccountPlanLineDto,
  ) {
    return this.plans.updateLine(user, id, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Delete('account-plan-lines/:id')
  deleteLine(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.plans.deleteLine(user, id);
  }
}
