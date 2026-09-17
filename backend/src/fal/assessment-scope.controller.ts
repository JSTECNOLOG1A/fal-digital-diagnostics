import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AuthUser } from '../auth/auth.types';
import { AssessmentScopeService } from './assessment-scope.service';

@ApiTags('fal-assessment-scope')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('fal/assessments/:id/scopes')
export class AssessmentScopeController {
  constructor(private readonly scopes: AssessmentScopeService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.scopes.list(user, id);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('generate')
  generate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.scopes.generate(user, id);
  }
}
