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
import { HierarchyService } from './hierarchy.service';
import {
  CreateCompanyDto,
  CreateGroupDto,
  CreateOperationalUnitDto,
  UpdateCompanyDto,
  UpdateGroupDto,
  UpdateOperationalUnitDto,
} from './dto/hierarchy.dto';

@ApiTags('hierarchy')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller()
export class HierarchyController {
  constructor(private readonly hierarchy: HierarchyService) {}

  /** HQ costuma enviar só X-Tenant-Id; mescla no DTO para create. */
  private withTenantHeader<T extends { tenantId?: string }>(
    dto: T,
    headerTenant?: string,
  ): T {
    if (dto.tenantId || !headerTenant) return dto;
    return { ...dto, tenantId: headerTenant };
  }

  @Get('groups')
  listGroups(@CurrentUser() user: AuthUser) {
    return this.hierarchy.listGroups(user);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('groups')
  createGroup(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateGroupDto,
    @Headers('x-tenant-id') headerTenant?: string,
  ) {
    return this.hierarchy.createGroup(
      user,
      this.withTenantHeader(dto, headerTenant),
    );
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Patch('groups/:id')
  updateGroup(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.hierarchy.updateGroup(user, id, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN)
  @Delete('groups/:id')
  deleteGroup(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.hierarchy.deleteGroup(user, id);
  }

  @Get('companies')
  listCompanies(
    @CurrentUser() user: AuthUser,
    @Query('groupId') groupId?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.hierarchy.listCompanies(
      user,
      groupId,
      includeArchived === 'true' || includeArchived === '1',
    );
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('companies')
  createCompany(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCompanyDto,
    @Headers('x-tenant-id') headerTenant?: string,
  ) {
    return this.hierarchy.createCompany(
      user,
      this.withTenantHeader(dto, headerTenant),
    );
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Patch('companies/:id')
  updateCompany(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.hierarchy.updateCompany(user, id, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN)
  @Delete('companies/:id')
  deleteCompany(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.hierarchy.deleteCompany(user, id);
  }

  @Get('units')
  listUnits(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
  ) {
    return this.hierarchy.listUnits(user, companyId);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('units')
  createUnit(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOperationalUnitDto,
    @Headers('x-tenant-id') headerTenant?: string,
  ) {
    return this.hierarchy.createUnit(
      user,
      this.withTenantHeader(dto, headerTenant),
    );
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Patch('units/:id')
  updateUnit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateOperationalUnitDto,
  ) {
    return this.hierarchy.updateUnit(user, id, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN)
  @Delete('units/:id')
  deleteUnit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.hierarchy.deleteUnit(user, id);
  }
}
