import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AuthUser } from '../auth/auth.types';
import { FinancialInsightService } from './financial-insight.service';
import {
  ConvertFinancialRecommendationDto,
  CreateManualFinancialFindingDto,
  GenerateFinancialFindingsDto,
  GenerateFinancialRecommendationsDto,
  ManageFinancialFindingDto,
  ManageFinancialRecommendationDto,
  UnconvertActionTaskDto,
  UpdateFinancialRecommendationDto,
} from './dto/financial-report.dto';

@ApiTags('financial-report-insights')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('financial-report/insights')
export class FinancialInsightController {
  constructor(private readonly insights: FinancialInsightService) {}

  @Get('findings')
  listFindings(@CurrentUser() user: AuthUser, @Query('financialDiagnosisId') financialDiagnosisId: string) {
    return this.insights.listFindings(user, financialDiagnosisId);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('findings/generate')
  generateFindings(@CurrentUser() user: AuthUser, @Body() dto: GenerateFinancialFindingsDto) {
    return this.insights.generateFindings(user, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('findings/manual')
  createManualFinding(@CurrentUser() user: AuthUser, @Body() dto: CreateManualFinancialFindingDto) {
    return this.insights.createManualFinding(user, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('findings/:id/manage')
  manageFinding(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ManageFinancialFindingDto) {
    return this.insights.manageFinding(user, id, dto);
  }

  @Get('recommendations')
  listRecommendations(@CurrentUser() user: AuthUser, @Query('financialDiagnosisId') financialDiagnosisId: string) {
    return this.insights.listRecommendations(user, financialDiagnosisId);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('recommendations/generate')
  generateRecommendations(@CurrentUser() user: AuthUser, @Body() dto: GenerateFinancialRecommendationsDto) {
    return this.insights.generateRecommendations(user, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('recommendations/:id/update')
  updateRecommendation(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateFinancialRecommendationDto) {
    return this.insights.updateRecommendation(user, id, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('recommendations/:id/manage')
  manageRecommendation(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ManageFinancialRecommendationDto) {
    return this.insights.manageRecommendation(user, id, dto);
  }

  @Get('action-proposals')
  listActionProposals(@CurrentUser() user: AuthUser, @Query('financialDiagnosisId') financialDiagnosisId: string) {
    return this.insights.listActionProposals(user, financialDiagnosisId);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('recommendations/convert')
  convertRecommendation(@CurrentUser() user: AuthUser, @Body() dto: ConvertFinancialRecommendationDto) {
    return this.insights.convertRecommendation(user, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('recommendations/unconvert')
  unconvertToTask(@CurrentUser() user: AuthUser, @Body() dto: UnconvertActionTaskDto) {
    return this.insights.unconvertToTask(user, dto);
  }
}
