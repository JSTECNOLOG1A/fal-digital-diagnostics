import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AuthUser } from '../auth/auth.types';
import { FinancialPurgeService } from './financial-purge.service';
import {
  DeleteFinancialUploadSafeDto,
  PurgeFinancialDiagnosisDto,
  PurgeFinancialUploadDerivedDto,
} from './dto/financial.dto';

/**
 * Equivalentes a invoke('purgeFinancialUploadData'/'purgeFinancialDerivedData'/
 * 'deleteFinancialUploadSafe', ...) do frontend. @Roles aqui já restringe a
 * hq_admin/tenant_admin (mesmo papel exigido no Base44 original); o service
 * confere de novo via canDelete() por defesa em profundidade.
 */
@ApiTags('financial')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('financial')
export class FinancialPurgeController {
  constructor(private readonly purge: FinancialPurgeService) {}

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN)
  @Post('purge-diagnosis')
  purgeDiagnosis(@CurrentUser() user: AuthUser, @Body() dto: PurgeFinancialDiagnosisDto) {
    return this.purge.purgeDiagnosis(user, dto.diagnosisId);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN)
  @Post('purge-upload-derived')
  purgeUploadDerived(@CurrentUser() user: AuthUser, @Body() dto: PurgeFinancialUploadDerivedDto) {
    return this.purge.purgeUploadDerived(user, dto.diagnosisId, dto.uploadId);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN)
  @Post('delete-upload-safe')
  deleteUploadSafe(@CurrentUser() user: AuthUser, @Body() dto: DeleteFinancialUploadSafeDto) {
    return this.purge.deleteUploadSafe(user, dto.financialDiagnosisId, dto.financialUploadId);
  }
}
