import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AuthUser } from '../auth/auth.types';
import { FinancialReportVersionService } from './financial-report-version.service';
import { FinancialReportPdfService } from './financial-report-pdf.service';
import {
  CreateFinancialReportVersionDto,
  FinalizeFinancialReportVersionDto,
  UpdateFinancialReportTextDto,
} from './dto/financial-report.dto';

@ApiTags('financial-report')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('financial-report')
export class FinancialReportController {
  constructor(
    private readonly versions: FinancialReportVersionService,
    private readonly pdf: FinancialReportPdfService,
  ) {}

  @Get(':diagnosisId/versions')
  listVersions(@CurrentUser() user: AuthUser, @Param('diagnosisId') diagnosisId: string) {
    return this.versions.listVersions(user, diagnosisId);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post(':diagnosisId/versions')
  generateOrUpdate(@CurrentUser() user: AuthUser, @Param('diagnosisId') diagnosisId: string, @Body() dto: CreateFinancialReportVersionDto) {
    return this.versions.generateOrUpdate(user, { ...dto, financialDiagnosisId: diagnosisId });
  }

  @Get('versions/:id')
  getVersion(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.versions.getVersion(user, id);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('versions/:id/text')
  updateText(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateFinancialReportTextDto) {
    return this.versions.updateReviewedText(user, id, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('versions/:id/finalize')
  finalize(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: FinalizeFinancialReportVersionDto) {
    return this.versions.finalize(user, id, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('versions/:id/export-pdf')
  exportPdf(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.pdf.exportPdf(user, id);
  }

  @Get('versions/:id/pdf')
  async downloadPdf(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.pdf.downloadPdf(user, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  /** HTML renderizado da versão — a prévia em tela carrega isto num iframe (mesmo template do PDF). */
  @Get('versions/:id/render-html')
  async getRenderHtml(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const html = await this.pdf.getRenderHtml(user, id);
    res.set({ 'Content-Type': 'text/html; charset=utf-8' });
    res.send(html);
  }
}
