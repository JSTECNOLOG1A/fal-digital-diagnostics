import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AuthUser } from '../auth/auth.types';
import { UsersService } from './users.service';
import { InviteUserDto, ResendInviteDto, RevokeUserDto, UpdateUserRoleDto } from './dto/users.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.users.list(user);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN)
  @Post('invite')
  invite(@CurrentUser() user: AuthUser, @Body() dto: InviteUserDto) {
    return this.users.invite(user, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN)
  @Post('revoke')
  revoke(@CurrentUser() user: AuthUser, @Body() dto: RevokeUserDto) {
    return this.users.revoke(user, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Get('administration')
  administration(@CurrentUser() user: AuthUser, @Query('tenantId') tenantId?: string) {
    return this.users.administration(user, tenantId);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN)
  @Patch(':id/role')
  updateRole(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.users.updateRole(user, { ...dto, userId: id });
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN)
  @Post('resend-invite')
  resendInvite(@CurrentUser() user: AuthUser, @Body() dto: ResendInviteDto) {
    return this.users.resendInvite(user, dto);
  }
}
