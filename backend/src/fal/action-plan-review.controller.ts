import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AuthUser } from '../auth/auth.types';
import { ActionPlanReviewService } from './action-plan-review.service';
import {
  CancelActionPlanReviewDto,
  CompleteActionPlanReviewDto,
  OpenActionPlanReviewDto,
} from './dto/action-plan.dto';

@ApiTags('action-plan-reviews')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('fal/action-plan-reviews')
export class ActionPlanReviewController {
  constructor(private readonly reviews: ActionPlanReviewService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('actionPlanId') actionPlanId: string) {
    return this.reviews.list(user, actionPlanId);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('open')
  open(@CurrentUser() user: AuthUser, @Body() dto: OpenActionPlanReviewDto) {
    return this.reviews.open(user, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('complete')
  complete(@CurrentUser() user: AuthUser, @Body() dto: CompleteActionPlanReviewDto) {
    return this.reviews.complete(user, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('cancel')
  cancel(@CurrentUser() user: AuthUser, @Body() dto: CancelActionPlanReviewDto) {
    return this.reviews.cancel(user, dto);
  }
}
