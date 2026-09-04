import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AuthUser } from '../auth/auth.types';
import { FalReadService } from './fal-read.service';

@ApiTags('fal-read')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('fal')
export class FalReadController {
  constructor(private readonly reads: FalReadService) {}

  @Get('diagnostic-snapshots')
  listSnapshots(
    @CurrentUser() user: AuthUser,
    @Query('assessmentId') assessmentId?: string,
    @Query('targetType') targetType?: string,
    @Query('targetId') targetId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reads.listDiagnosticSnapshots(user, {
      assessmentId, targetType, targetId, limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('diagnostic-snapshots/:id')
  getSnapshot(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reads.getDiagnosticSnapshot(user, id);
  }

  @Get('aggregate-snapshots')
  listAggregates(
    @CurrentUser() user: AuthUser,
    @Query('levelType') levelType?: string,
    @Query('levelId') levelId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reads.listAggregateSnapshots(user, {
      levelType, levelId, limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('systemic-crossings')
  listCrossings(@CurrentUser() user: AuthUser, @Query('assessmentId') assessmentId: string) {
    return this.reads.listSystemicCrossings(user, assessmentId);
  }

  @Get('systemic-dimension-impacts')
  listDimensionImpacts(@CurrentUser() user: AuthUser, @Query('assessmentId') assessmentId: string) {
    return this.reads.listSystemicDimensionImpacts(user, assessmentId);
  }

  @Get('action-task-reviews')
  listActionTaskReviews(@CurrentUser() user: AuthUser, @Query('taskId') taskId: string) {
    return this.reads.listActionTaskReviews(user, taskId);
  }

  @Get('action-task-activities')
  listActionTaskActivities(@CurrentUser() user: AuthUser, @Query('taskId') taskId: string) {
    return this.reads.listActionTaskActivities(user, taskId);
  }
}
