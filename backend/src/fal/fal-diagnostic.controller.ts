import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AuthUser } from '../auth/auth.types';
import { FalDiagnosticService } from './fal-diagnostic.service';
import { PublishAssessmentDto } from './dto/fal.dto';

@ApiTags('fal-diagnostic')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('fal/assessments/:id')
export class FalDiagnosticController {
  constructor(private readonly diagnostic: FalDiagnosticService) {}

  @Get('diagnostic')
  getLatest(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.diagnostic.getLatestSnapshot(user, id);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('diagnostic')
  compute(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.diagnostic.computeDiagnostic(user, id);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('priority')
  computePriority(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.diagnostic.computePriority(user, id);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('intelligence')
  computeIntelligence(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('benchmarkGroup') benchmarkGroup?: string,
  ) {
    return this.diagnostic.computeIntelligence(user, id, benchmarkGroup);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('publish')
  publish(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: PublishAssessmentDto) {
    return this.diagnostic.publish(user, id, dto?.cycleId);
  }
}
