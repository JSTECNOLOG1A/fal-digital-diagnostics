import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AuthUser } from '../auth/auth.types';
import { FalQuestionSwapService } from './fal-question-swap.service';
import { SwapFalQuestionDto } from './dto/fal.dto';

@ApiTags('fal-question-swap')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('fal/assessments/:id/question-swaps')
export class FalQuestionSwapController {
  constructor(private readonly swaps: FalQuestionSwapService) {}

  @Roles(ROLES.HQ_ADMIN)
  @Post()
  swap(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SwapFalQuestionDto) {
    return this.swaps.swap(user, id, dto.originalQuestionId, dto.swapReason, dto.swapReasonLabel);
  }
}
