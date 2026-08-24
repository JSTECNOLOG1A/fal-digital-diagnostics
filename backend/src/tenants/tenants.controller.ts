import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AuthUser } from '../auth/auth.types';
import { TenantsService } from './tenants.service';
import { CreateTenantDto, UpdateTenantDto } from './dto/tenant.dto';

@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.tenants.list(user);
  }

  @Get(':tenantId')
  get(@CurrentUser() user: AuthUser, @Param('tenantId') tenantId: string) {
    return this.tenants.get(user, tenantId);
  }

  @Roles(ROLES.HQ_ADMIN)
  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenants.create(dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN)
  @Patch(':tenantId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenants.update(user, tenantId, dto);
  }
}
