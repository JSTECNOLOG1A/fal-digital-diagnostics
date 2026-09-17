import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AuthUser } from '../auth/auth.types';
import { FalContentSuggestionService } from './fal-content-suggestion.service';
import { GenerateFalContentSuggestionDto, ReviewFalContentSuggestionDto } from './dto/fal.dto';

@ApiTags('fal-content-suggestions')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('fal/content-suggestions')
export class FalContentSuggestionController {
  constructor(private readonly suggestions: FalContentSuggestionService) {}

  @Roles(ROLES.HQ_ADMIN)
  @Get()
  list(@Query('contentType') contentType?: string) {
    return this.suggestions.listPending(contentType);
  }

  @Roles(ROLES.HQ_ADMIN)
  @Post('generate')
  generate(@CurrentUser() user: AuthUser, @Body() dto: GenerateFalContentSuggestionDto) {
    return this.suggestions.generate(user, dto);
  }

  @Roles(ROLES.HQ_ADMIN)
  @Post(':id/review')
  review(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewFalContentSuggestionDto,
  ) {
    return this.suggestions.review(user, id, dto);
  }
}
