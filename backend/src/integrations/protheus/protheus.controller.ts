import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../../shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { AuthUser } from '../../auth/auth.types';
import { ProtheusService } from './protheus.service';
import {
  FetchProtheusResourceDto,
  StartProtheusSyncDto,
  UpsertProtheusConnectionDto,
} from './dto/protheus.dto';

@ApiTags('integrations/protheus')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('integrations/protheus')
export class ProtheusController {
  constructor(private readonly protheus: ProtheusService) {}

  @Get('connection')
  getConnection(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.protheus.getConnection(user, tenantId);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN)
  @Post('connection')
  upsertConnection(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertProtheusConnectionDto,
  ) {
    return this.protheus.upsertConnection(user, dto);
  }

  /**
   * Busca síncrona — use resource=chart_of_accounts para plano de contas.
   * Informe pathOverride se o AdvPL do cliente publicar outro caminho em /rest.
   */
  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('fetch')
  fetchResource(
    @CurrentUser() user: AuthUser,
    @Body() dto: FetchProtheusResourceDto,
  ) {
    return this.protheus.fetchResource(user, dto);
  }

  /** Lista empresas/filiais acessíveis (diagnóstico do 403). */
  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('discover')
  discover(
    @CurrentUser() user: AuthUser,
    @Body() body: { tenantId?: string },
  ) {
    return this.protheus.discoverCompanies(user, body?.tenantId);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('sync')
  startSync(@CurrentUser() user: AuthUser, @Body() dto: StartProtheusSyncDto) {
    return this.protheus.startSync(user, dto);
  }

  @Get('jobs')
  listJobs(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.protheus.listJobs(user, tenantId);
  }

  @Get('staging')
  listStaging(
    @CurrentUser() user: AuthUser,
    @Query('resource') resource?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.protheus.listStaging(user, resource, tenantId);
  }
}
