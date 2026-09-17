import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AuthUser } from '../auth/auth.types';
import { FalResponseService } from './fal-response.service';
import { UpsertFalResponseDto } from './dto/fal.dto';

@ApiTags('fal-responses')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('fal/responses')
export class FalResponseController {
  constructor(private readonly responses: FalResponseService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('assessmentId') assessmentId: string,
    @Query('dimensionKey') dimensionKey?: string,
  ) {
    return this.responses.listByAssessment(user, assessmentId, dimensionKey);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: UpsertFalResponseDto) {
    return this.responses.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: Partial<UpsertFalResponseDto>,
  ) {
    return this.responses.update(user, id, dto);
  }
}
