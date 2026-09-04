import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AuthUser } from '../auth/auth.types';
import { MfisService } from './mfis.service';

@ApiTags('mfis')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('fal/assessments/:id/mfis')
export class MfisController {
  constructor(private readonly mfis: MfisService) {}

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post()
  compute(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.mfis.compute(user, id);
  }
}
