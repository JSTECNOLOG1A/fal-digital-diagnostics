import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AuthUser } from '../auth/auth.types';
import { AssessmentFlowService } from './assessment-flow.service';

@ApiTags('fal-assessment-flow')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('fal/assessments/:id/flow')
export class AssessmentFlowController {
  constructor(private readonly flow: AssessmentFlowService) {}

  @Get()
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.flow.getFlow(user, id);
  }
}
