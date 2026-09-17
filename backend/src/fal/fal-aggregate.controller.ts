import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AuthUser } from '../auth/auth.types';
import { FalAggregateService } from './fal-aggregate.service';

@ApiTags('fal-aggregate')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('fal')
export class FalAggregateController {
  constructor(private readonly aggregate: FalAggregateService) {}

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('companies/:id/aggregate')
  computeCompany(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.aggregate.computeCompanyAggregate(user, id);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('groups/:id/aggregate')
  computeGroup(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.aggregate.computeGroupAggregate(user, id);
  }
}
