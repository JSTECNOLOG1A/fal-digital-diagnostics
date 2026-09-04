import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { ROLES, canWrite } from '../shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AuthUser } from '../auth/auth.types';
import { StorageService } from '../storage/storage.service';
import { ReportService } from './report.service';
import {
  ArchiveReportVersionDto,
  BeginPdfArtifactDto,
  CommitPdfArtifactDto,
  GenerateReportVersionDto,
} from './dto/report.dto';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('fal/reports')
export class ReportController {
  constructor(
    private readonly reports: ReportService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('assessmentId') assessmentId?: string,
    @Query('reportType') reportType?: string,
  ) {
    return this.reports.list(user, { assessmentId, reportType });
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reports.get(user, id);
  }

  @Get(':id/snapshot')
  getSnapshot(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reports.getSnapshot(user, id);
  }

  @Get(':id/render-payload')
  getRenderPayload(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reports.getRenderPayload(user, id);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('generate')
  generate(@CurrentUser() user: AuthUser, @Body() dto: GenerateReportVersionDto) {
    return this.reports.generate(user, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post(':id/set-official')
  setOfficial(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reports.setOfficial(user, id);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('archive')
  archive(@CurrentUser() user: AuthUser, @Body() dto: ArchiveReportVersionDto) {
    return this.reports.archive(user, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('pdf/begin')
  beginPdf(@CurrentUser() user: AuthUser, @Body() dto: BeginPdfArtifactDto) {
    return this.reports.beginPdf(user, dto);
  }

  /**
   * Passo intermediário do fluxo de PDF: o navegador monta o PDF
   * (html2canvas/jsPDF, lógica existente do frontend) e sobe o binário aqui
   * — equivalente ao Core.UploadFile do base44, mas gravando no MinIO real.
   */
  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('pdf/storage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async uploadPdf(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File) {
    if (!canWrite(user.role)) throw new ForbiddenException();
    if (!file?.buffer?.length) throw new ForbiddenException('Arquivo vazio ou ausente.');
    const objectKey = `reports/${user.tenantId ?? 'hq'}/${randomUUID()}-${file.originalname}`;
    await this.storage.putFile(objectKey, file.buffer, file.mimetype);
    return { fileUrl: objectKey, uploadIdentifier: objectKey };
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('pdf/commit')
  commitPdf(@CurrentUser() user: AuthUser, @Body() dto: CommitPdfArtifactDto) {
    return this.reports.commitPdf(user, dto);
  }
}
