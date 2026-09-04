import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AuthUser } from '../auth/auth.types';
import { ActionTaskService } from './action-task.service';
import { CreateManualActionTaskDto, UpdateActionTaskWithHistoryDto } from './dto/action-plan.dto';

@ApiTags('action-tasks')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('fal/action-tasks')
export class ActionTaskController {
  constructor(private readonly tasks: ActionTaskService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('planId') planId: string) {
    return this.tasks.list(user, planId);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('manual')
  createManual(@CurrentUser() user: AuthUser, @Body() dto: CreateManualActionTaskDto) {
    return this.tasks.createManual(user, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('update-with-history')
  updateWithHistory(@CurrentUser() user: AuthUser, @Body() dto: UpdateActionTaskWithHistoryDto) {
    return this.tasks.updateWithHistory(user, dto);
  }
}
