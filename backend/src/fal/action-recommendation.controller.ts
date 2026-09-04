import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AuthUser } from '../auth/auth.types';
import { ActionRecommendationService } from './action-recommendation.service';
import { GenerateActionRecommendationsDto, ManageActionRecommendationDto } from './dto/action-plan.dto';

@ApiTags('action-recommendations')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('fal/action-recommendations')
export class ActionRecommendationController {
  constructor(private readonly recs: ActionRecommendationService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('assessmentId') assessmentId?: string,
    @Query('actionPlanId') actionPlanId?: string,
    @Query('status') status?: string,
  ) {
    return this.recs.list(user, { assessmentId, actionPlanId, status });
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('generate')
  generate(@CurrentUser() user: AuthUser, @Body() dto: GenerateActionRecommendationsDto) {
    return this.recs.generate(user, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('manage')
  manage(@CurrentUser() user: AuthUser, @Body() dto: ManageActionRecommendationDto) {
    return this.recs.manage(user, dto);
  }
}
