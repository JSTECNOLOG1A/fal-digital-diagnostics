import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AuthUser } from '../auth/auth.types';
import { MqeService } from './mqe.service';
import { UpsertMQEResponseDto } from './dto/fal.dto';

@ApiTags('mqe')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('fal/mqe')
export class MqeController {
  constructor(private readonly mqe: MqeService) {}

  @Get('questions')
  listQuestions(
    @Query('methodVersionId') methodVersionId: string,
    @Query('crossingKey') crossingKey?: string,
  ) {
    return this.mqe.listQuestions(methodVersionId, crossingKey);
  }

  @Get('responses')
  listResponses(
    @CurrentUser() user: AuthUser,
    @Query('assessmentId') assessmentId: string,
    @Query('crossingKey') crossingKey?: string,
  ) {
    return this.mqe.listResponses(user, assessmentId, crossingKey);
  }

  @Post('responses')
  create(@CurrentUser() user: AuthUser, @Body() dto: UpsertMQEResponseDto) {
    return this.mqe.create(user, dto);
  }

  @Patch('responses/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: Partial<UpsertMQEResponseDto>,
  ) {
    return this.mqe.update(user, id, dto);
  }
}
