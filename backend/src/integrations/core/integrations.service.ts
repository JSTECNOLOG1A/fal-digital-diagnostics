import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'crypto';
import {
  IntegrationDirection,
  Prisma,
  WebhookDeliveryStatus,
} from '@prisma/client';
import { isHQ } from '../../shared';
import { AuthUser } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { encryptSecret, decryptSecret } from '../../common/crypto/credentials.crypto';
import { hashApiKey, ApiKeyPrincipal } from './guards/api-key.guard';
import {
  CreateApiKeyDto,
  CreateWebhookEndpointDto,
  DispatchWebhookDto,
  UpsertIntegrationConnectionDto,
} from './dto/integrations.dto';

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  private cryptoKey() {
    return this.config.get<string>(
      'CREDENTIALS_ENCRYPTION_KEY',
      'fal-dev-only-change-me-please-32b',
    );
  }

  private resolveTenantId(actor: AuthUser, explicit?: string): string {
    if (isHQ(actor.role)) {
      const id = explicit ?? actor.tenantId;
      if (!id) throw new ForbiddenException('tenantId is required');
      return id;
    }
    if (!actor.tenantId) throw new ForbiddenException('No tenant scope');
    if (explicit && explicit !== actor.tenantId) {
      throw new ForbiddenException('Tenant scope violation');
    }
    return actor.tenantId;
  }

  private rls(actor: AuthUser, tenantId?: string | null) {
    return {
      tenantId: tenantId ?? actor.tenantId,
      isHq: isHQ(actor.role),
    };
  }

  // ── Connections ──────────────────────────────────────────

  listConnections(actor: AuthUser, tenantId?: string) {
    const tid = this.resolveTenantId(actor, tenantId);
    return this.prisma.withTenantContext(this.rls(actor, tid), (tx) =>
      tx.integrationConnection.findMany({
        where: { tenantId: tid, deletedAt: null },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          tenantId: true,
          provider: true,
          name: true,
          direction: true,
          baseUrl: true,
          authType: true,
          config: true,
          isActive: true,
          lastSuccessAt: true,
          lastErrorAt: true,
          lastErrorMessage: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    );
  }

  async upsertConnection(actor: AuthUser, dto: UpsertIntegrationConnectionDto) {
    const tenantId = this.resolveTenantId(actor, dto.tenantId);
    const encryptedSecrets = dto.secrets
      ? encryptSecret(JSON.stringify(dto.secrets), this.cryptoKey())
      : undefined;

    const connection = await this.prisma.withTenantContext(
      this.rls(actor, tenantId),
      (tx) =>
        tx.integrationConnection.upsert({
          where: {
            tenantId_provider_name: {
              tenantId,
              provider: dto.provider,
              name: dto.name,
            },
          },
          create: {
            tenantId,
            provider: dto.provider,
            name: dto.name,
            direction: (dto.direction as IntegrationDirection) ?? 'outbound',
            baseUrl: dto.baseUrl,
            authType: dto.authType ?? 'api_key',
            encryptedSecrets,
            config: (dto.config as Prisma.InputJsonValue) ?? undefined,
          },
          update: {
            direction: dto.direction as IntegrationDirection | undefined,
            baseUrl: dto.baseUrl,
            authType: dto.authType,
            ...(encryptedSecrets !== undefined ? { encryptedSecrets } : {}),
            config: (dto.config as Prisma.InputJsonValue) ?? undefined,
            deletedAt: null,
            isActive: true,
          },
        }),
    );

    await this.audit.log({
      actorId: actor.id,
      tenantId,
      action: 'integration.connection.upsert',
      entityType: 'integration_connection',
      entityId: connection.id,
      metadata: { provider: dto.provider, name: dto.name },
    });

    const { encryptedSecrets: _omit, ...safe } = connection;
    return safe;
  }

  // ── API Keys ─────────────────────────────────────────────

  listApiKeys(actor: AuthUser, tenantId?: string) {
    const tid = this.resolveTenantId(actor, tenantId);
    return this.prisma.withTenantContext(this.rls(actor, tid), (tx) =>
      tx.integrationApiKey.findMany({
        where: { tenantId: tid },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          tenantId: true,
          name: true,
          keyPrefix: true,
          scopes: true,
          isActive: true,
          lastUsedAt: true,
          expiresAt: true,
          revokedAt: true,
          createdAt: true,
        },
      }),
    );
  }

  async createApiKey(actor: AuthUser, dto: CreateApiKeyDto) {
    const tenantId = this.resolveTenantId(actor, dto.tenantId);
    const rawKey = `fal_live_${randomBytes(24).toString('base64url')}`;
    const keyPrefix = rawKey.slice(0, 16);
    const keyHash = hashApiKey(rawKey);
    const scopes = dto.scopes?.length
      ? dto.scopes
      : ['partner:ping', 'webhooks:receive'];

    const record = await this.prisma.withTenantContext(
      this.rls(actor, tenantId),
      (tx) =>
        tx.integrationApiKey.create({
          data: {
            tenantId,
            name: dto.name,
            keyPrefix,
            keyHash,
            scopes,
          },
        }),
    );

    await this.audit.log({
      actorId: actor.id,
      tenantId,
      action: 'integration.api_key.create',
      entityType: 'integration_api_key',
      entityId: record.id,
      metadata: { name: dto.name, scopes },
    });

    return {
      id: record.id,
      name: record.name,
      keyPrefix: record.keyPrefix,
      scopes: record.scopes,
      apiKey: rawKey,
      warning: 'Guarde esta chave agora. Ela não será exibida novamente.',
    };
  }

  async revokeApiKey(actor: AuthUser, id: string, tenantId?: string) {
    const tid = this.resolveTenantId(actor, tenantId);
    const updated = await this.prisma.withTenantContext(
      this.rls(actor, tid),
      async (tx) => {
        const existing = await tx.integrationApiKey.findFirst({
          where: { id, tenantId: tid },
        });
        if (!existing) throw new NotFoundException('API key not found');
        return tx.integrationApiKey.update({
          where: { id },
          data: { isActive: false, revokedAt: new Date() },
        });
      },
    );

    await this.audit.log({
      actorId: actor.id,
      tenantId: tid,
      action: 'integration.api_key.revoke',
      entityType: 'integration_api_key',
      entityId: id,
    });

    return { id: updated.id, revokedAt: updated.revokedAt };
  }

  // ── Webhook endpoints (outbound) ─────────────────────────

  listWebhookEndpoints(actor: AuthUser, tenantId?: string) {
    const tid = this.resolveTenantId(actor, tenantId);
    return this.prisma.withTenantContext(this.rls(actor, tid), (tx) =>
      tx.integrationWebhookEndpoint.findMany({
        where: { tenantId: tid, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          tenantId: true,
          name: true,
          targetUrl: true,
          events: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    );
  }

  async createWebhookEndpoint(actor: AuthUser, dto: CreateWebhookEndpointDto) {
    const tenantId = this.resolveTenantId(actor, dto.tenantId);
    const plainSecret =
      dto.signingSecret || randomBytes(24).toString('base64url');
    const encryptedSecret = encryptSecret(plainSecret, this.cryptoKey());

    const endpoint = await this.prisma.withTenantContext(
      this.rls(actor, tenantId),
      (tx) =>
        tx.integrationWebhookEndpoint.create({
          data: {
            tenantId,
            name: dto.name,
            targetUrl: dto.targetUrl,
            encryptedSecret,
            events: dto.events?.length
              ? dto.events
              : ['group.created', 'company.created', 'company.updated'],
          },
        }),
    );

    await this.audit.log({
      actorId: actor.id,
      tenantId,
      action: 'integration.webhook_endpoint.create',
      entityType: 'integration_webhook_endpoint',
      entityId: endpoint.id,
    });

    return {
      id: endpoint.id,
      name: endpoint.name,
      targetUrl: endpoint.targetUrl,
      events: endpoint.events,
      signingSecret: plainSecret,
      warning: 'Guarde o signingSecret para validar HMAC. Não será exibido de novo.',
    };
  }

  async dispatchWebhook(actor: AuthUser, dto: DispatchWebhookDto) {
    const tenantId = this.resolveTenantId(actor, dto.tenantId);
    const endpoints = await this.prisma.withTenantContext(
      this.rls(actor, tenantId),
      (tx) =>
        tx.integrationWebhookEndpoint.findMany({
          where: {
            tenantId,
            deletedAt: null,
            isActive: true,
            OR: [
              { events: { has: dto.event } },
              { events: { has: '*' } },
            ],
          },
        }),
    );

    const results = [];
    for (const endpoint of endpoints) {
      const delivery = await this.deliverWebhook(tenantId, endpoint, dto.event, dto.payload);
      results.push(delivery);
    }

    await this.audit.log({
      actorId: actor.id,
      tenantId,
      action: 'integration.webhook.dispatch',
      entityType: 'integration_webhook',
      metadata: { event: dto.event, endpoints: endpoints.length },
    });

    return { event: dto.event, deliveries: results };
  }

  private async deliverWebhook(
    tenantId: string,
    endpoint: {
      id: string;
      targetUrl: string;
      encryptedSecret: string | null;
    },
    event: string,
    payload: Record<string, unknown>,
  ) {
    const body = {
      id: randomBytes(8).toString('hex'),
      event,
      createdAt: new Date().toISOString(),
      data: payload,
    };
    const rawBody = JSON.stringify(body);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-FAL-Event': event,
      'User-Agent': 'FAL-Integrations/1.0',
    };

    if (endpoint.encryptedSecret) {
      try {
        const secret = decryptSecret(endpoint.encryptedSecret, this.cryptoKey());
        const signature = createHmac('sha256', secret).update(rawBody).digest('hex');
        headers['X-FAL-Signature'] = `sha256=${signature}`;
      } catch {
        // sem assinatura se não der para decriptar
      }
    }

    let status: WebhookDeliveryStatus = WebhookDeliveryStatus.pending;
    let responseCode: number | null = null;
    let errorMessage: string | null = null;
    let deliveredAt: Date | null = null;

    try {
      const res = await fetch(endpoint.targetUrl, {
        method: 'POST',
        headers,
        body: rawBody,
        signal: AbortSignal.timeout(15_000),
      });
      responseCode = res.status;
      if (res.ok) {
        status = WebhookDeliveryStatus.delivered;
        deliveredAt = new Date();
      } else {
        status = WebhookDeliveryStatus.failed;
        errorMessage = `HTTP ${res.status}`;
      }
    } catch (err) {
      status = WebhookDeliveryStatus.failed;
      errorMessage = err instanceof Error ? err.message : 'Delivery failed';
    }

    return this.prisma.withTenantContext(
      { tenantId, isHq: true },
      (tx) =>
        tx.integrationWebhookDelivery.create({
          data: {
            tenantId,
            endpointId: endpoint.id,
            event,
            payload: body as Prisma.InputJsonValue,
            status,
            attempts: 1,
            responseCode,
            errorMessage,
            deliveredAt,
          },
          select: {
            id: true,
            endpointId: true,
            event: true,
            status: true,
            responseCode: true,
            errorMessage: true,
            deliveredAt: true,
          },
        }),
    );
  }

  // ── Inbound (API Key) ────────────────────────────────────

  async receiveInbound(
    principal: ApiKeyPrincipal,
    provider: string,
    body: Record<string, unknown>,
    headers: Record<string, unknown>,
  ) {
    const eventType =
      (typeof body.eventType === 'string' && body.eventType) ||
      (typeof body.event === 'string' && body.event) ||
      'unknown';
    const externalId =
      typeof body.externalId === 'string'
        ? body.externalId
        : typeof body.id === 'string'
          ? body.id
          : null;

    const event = await this.prisma.withTenantContext(
      { tenantId: principal.tenantId, isHq: true },
      (tx) =>
        tx.integrationInboundEvent.create({
          data: {
            tenantId: principal.tenantId,
            provider,
            eventType,
            externalId,
            payload: body as Prisma.InputJsonValue,
            headers: headers as Prisma.InputJsonValue,
          },
        }),
    );

    await this.audit.log({
      tenantId: principal.tenantId,
      action: 'integration.inbound.receive',
      entityType: 'integration_inbound_event',
      entityId: event.id,
      metadata: { provider, eventType, apiKeyId: principal.apiKeyId },
    });

    return {
      accepted: true,
      eventId: event.id,
      provider,
      eventType,
    };
  }

  partnerPing(principal: ApiKeyPrincipal) {
    return {
      ok: true,
      service: 'fal-integrations',
      tenantId: principal.tenantId,
      apiKey: principal.name,
      scopes: principal.scopes,
      serverTime: new Date().toISOString(),
    };
  }

  listInboundEvents(actor: AuthUser, tenantId?: string, provider?: string) {
    const tid = this.resolveTenantId(actor, tenantId);
    return this.prisma.withTenantContext(this.rls(actor, tid), (tx) =>
      tx.integrationInboundEvent.findMany({
        where: {
          tenantId: tid,
          ...(provider ? { provider } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  }

  listJobs(actor: AuthUser, tenantId?: string) {
    const tid = this.resolveTenantId(actor, tenantId);
    return this.prisma.withTenantContext(this.rls(actor, tid), (tx) =>
      tx.integrationJob.findMany({
        where: { tenantId: tid },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    );
  }
}
