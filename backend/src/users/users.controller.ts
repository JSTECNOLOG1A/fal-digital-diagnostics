import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AuthUser } from '../auth/auth.types';
import { UsersService } from './users.service';
import { InviteUserDto, RevokeUserDto } from './dto/users.dto';

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
}
