import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AuthUser } from '../auth/auth.types';
import { AssessmentService } from './assessment.service';
import {
  CreateAssessmentDto,
  ListAssessmentsQueryDto,
  UpdateAssessmentDto,
} from './dto/fal.dto';

@ApiTags('fal-assessments')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('fal/assessments')
export class AssessmentController {
  constructor(private readonly assessments: AssessmentService) {}

  private withTenantHeader<T extends { tenantId?: string }>(
    dto: T,
    headerTenant?: string,
  ): T {
    if (dto.tenantId || !headerTenant) return dto;
    return { ...dto, tenantId: headerTenant };
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListAssessmentsQueryDto) {
    return this.assessments.list(user, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.assessments.get(user, id);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAssessmentDto,
    @Headers('x-tenant-id') headerTenant?: string,
  ) {
    return this.assessments.create(user, this.withTenantHeader(dto, headerTenant));
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAssessmentDto,
  ) {
    return this.assessments.update(user, id, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN)
  @Delete(':id')
  delete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.assessments.delete(user, id);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post(':id/build-question-set')
  buildQuestionSet(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.assessments.buildQuestionSet(user, id);
  }
}
