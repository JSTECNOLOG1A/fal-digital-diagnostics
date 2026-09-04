import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AuthUser } from '../auth/auth.types';
import { FinancialUploadService } from './financial-upload.service';
import { CreateFinancialUploadMetaDto, UpdateFinancialUploadDto } from './dto/financial.dto';

@ApiTags('financial')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('financial/uploads')
export class FinancialUploadController {
  constructor(private readonly uploads: FinancialUploadService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('financialDiagnosisId') financialDiagnosisId: string) {
    return this.uploads.list(user, financialDiagnosisId);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.uploads.get(user, id);
  }

  /**
   * Passo 1 do upload (equivalente a base44.integrations.Core.UploadFile):
   * só grava o arquivo no MinIO e devolve a chave — sem criar nenhum
   * registro FinancialUpload ainda.
   */
  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('storage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  uploadFile(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File) {
    return this.uploads.uploadFile(user, file);
  }

  /** Passo 2: cria o registro a partir do fileUrl obtido em POST .../storage. */
  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateFinancialUploadMetaDto) {
    return this.uploads.create(user, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateFinancialUploadDto) {
    return this.uploads.update(user, id, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.uploads.delete(user, id);
  }
}
