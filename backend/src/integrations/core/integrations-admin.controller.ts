import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../../shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { AuthUser } from '../../auth/auth.types';
import { IntegrationsService } from './integrations.service';
import {
  CreateApiKeyDto,
  CreateWebhookEndpointDto,
  DispatchWebhookDto,
  UpsertIntegrationConnectionDto,
} from './dto/integrations.dto';

@ApiTags('integrations')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('integrations')
export class IntegrationsAdminController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get('connections')
  listConnections(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.integrations.listConnections(user, tenantId);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN)
  @Post('connections')
  upsertConnection(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertIntegrationConnectionDto,
  ) {
    return this.integrations.upsertConnection(user, dto);
  }

  @Get('api-keys')
  listApiKeys(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.integrations.listApiKeys(user, tenantId);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN)
  @Post('api-keys')
  createApiKey(@CurrentUser() user: AuthUser, @Body() dto: CreateApiKeyDto) {
    return this.integrations.createApiKey(user, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN)
  @Delete('api-keys/:id')
  revokeApiKey(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.integrations.revokeApiKey(user, id, tenantId);
  }

  @Get('webhooks/endpoints')
  listWebhookEndpoints(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.integrations.listWebhookEndpoints(user, tenantId);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN)
  @Post('webhooks/endpoints')
  createWebhookEndpoint(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateWebhookEndpointDto,
  ) {
    return this.integrations.createWebhookEndpoint(user, dto);
  }

  @Roles(ROLES.HQ_ADMIN, ROLES.TENANT_ADMIN, ROLES.CONSULTANT)
  @Post('webhooks/dispatch')
  dispatchWebhook(
    @CurrentUser() user: AuthUser,
    @Body() dto: DispatchWebhookDto,
  ) {
    return this.integrations.dispatchWebhook(user, dto);
  }

  @Get('inbound-events')
  listInboundEvents(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId?: string,
    @Query('provider') provider?: string,
  ) {
    return this.integrations.listInboundEvents(user, tenantId, provider);
  }

  @Get('jobs')
  listJobs(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.integrations.listJobs(user, tenantId);
  }
}
