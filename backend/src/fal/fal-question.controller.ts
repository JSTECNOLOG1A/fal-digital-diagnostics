import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../shared';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { FalQuestionService } from './fal-question.service';
import { CreateFalQuestionDto, ListFalQuestionsQueryDto } from './dto/fal.dto';

@ApiTags('fal-questions')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('fal/questions')
export class FalQuestionController {
  constructor(private readonly questions: FalQuestionService) {}

  @Get()
  list(@Query() query: ListFalQuestionsQueryDto) {
    return this.questions.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.questions.get(id);
  }

  @Roles(ROLES.HQ_ADMIN)
  @Post()
  create(@Body() dto: CreateFalQuestionDto) {
    return this.questions.create(dto);
  }
}
