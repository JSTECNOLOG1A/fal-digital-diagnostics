import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AuthUser } from '../auth/auth.types';
import { ActionPlanService } from './action-plan.service';
import { GenerateActionPlanDto, ListActionPlansQueryDto } from './dto/action-plan.dto';

@ApiTags('action-plans')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('fal/action-plans')
export class ActionPlanController {
  constructor(private readonly plans: ActionPlanService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListActionPlansQueryDto) {
    return this.plans.list(user, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.plans.get(user, id);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('generate')
  generate(@CurrentUser() user: AuthUser, @Body() dto: GenerateActionPlanDto) {
    return this.plans.generate(user, dto);
  }
}
