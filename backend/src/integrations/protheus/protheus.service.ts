import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma, SyncJobStatus } from '@prisma/client';
import { isHQ, ROLES } from '../../shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { AuthUser } from '../../auth/auth.types';
import {
  decryptSecret,
  encryptSecret,
} from '../../common/crypto/credentials.crypto';
import {
  FetchProtheusResourceDto,
  StartProtheusSyncDto,
  UpsertProtheusConnectionDto,
} from './dto/protheus.dto';
import {
  PROTHEUS_SYNC_QUEUE,
  ProtheusSyncJobPayload,
} from './protheus.constants';
import { ProtheusClient } from './protheus.client';

@Injectable()
export class ProtheusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    @InjectQueue(PROTHEUS_SYNC_QUEUE)
    private readonly queue: Queue<ProtheusSyncJobPayload>,
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

  private rls(actor: AuthUser, tenantId: string) {
    return {
      tenantId,
      isHq: isHQ(actor.role),
    };
  }

  private toPublicConnection(conn: {
    id: string;
    tenantId: string;
    baseUrl: string;
    username: string;
    companyCode: string;
    branchCode: string | null;
    isActive: boolean;
    lastSyncAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: conn.id,
      tenantId: conn.tenantId,
      baseUrl: conn.baseUrl,
      username: conn.username,
      companyCode: conn.companyCode,
      branchCode: conn.branchCode,
      isActive: conn.isActive,
      lastSyncAt: conn.lastSyncAt,
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt,
    };
  }

  async getConnection(actor: AuthUser, tenantId?: string) {
    const id = this.resolveTenantId(actor, tenantId);
    const conn = await this.prisma.withTenantContext(this.rls(actor, id), (tx) =>
      tx.protheusConnection.findUnique({ where: { tenantId: id } }),
    );
    if (!conn) return null;
    return this.toPublicConnection(conn);
  }

  async upsertConnection(actor: AuthUser, dto: UpsertProtheusConnectionDto) {
    if (actor.role !== ROLES.HQ_ADMIN && actor.role !== ROLES.TENANT_ADMIN) {
      throw new ForbiddenException();
    }

    const tenantId = this.resolveTenantId(actor, dto.tenantId);
    const encryptedPassword = encryptSecret(dto.password, this.cryptoKey());

    const conn = await this.prisma.withTenantContext(
      this.rls(actor, tenantId),
      (tx) =>
        tx.protheusConnection.upsert({
          where: { tenantId },
          create: {
            tenantId,
            baseUrl: dto.baseUrl.replace(/\/$/, ''),
            username: dto.username,
            encryptedPassword,
            companyCode: dto.companyCode,
            branchCode: dto.branchCode,
          },
          update: {
            baseUrl: dto.baseUrl.replace(/\/$/, ''),
            username: dto.username,
            encryptedPassword,
            companyCode: dto.companyCode,
            branchCode: dto.branchCode,
            isActive: true,
          },
        }),
    );

    await this.audit.log({
      actorId: actor.id,
      tenantId,
      action: 'protheus.connection.upsert',
      entityType: 'protheus_connection',
      entityId: conn.id,
    });

    return this.toPublicConnection(conn);
  }

  /**
   * Busca síncrona (ex.: plano de contas) — não depende do worker Redis.
   * Grava staging e devolve as linhas imediatamente.
   */
  async fetchResource(actor: AuthUser, dto: FetchProtheusResourceDto) {
    if (
      actor.role !== ROLES.HQ_ADMIN &&
      actor.role !== ROLES.TENANT_ADMIN &&
      actor.role !== ROLES.CONSULTANT
    ) {
      throw new ForbiddenException();
    }

    const tenantId = this.resolveTenantId(actor, dto.tenantId);
    const connection = await this.prisma.withTenantContext(
      this.rls(actor, tenantId),
      (tx) =>
        tx.protheusConnection.findFirst({
          where: { tenantId, isActive: true },
        }),
    );
    if (!connection) {
      throw new NotFoundException(
        'Conexão Protheus não configurada. Salve baseUrl, usuário e senha antes.',
      );
    }

    let password: string;
    try {
      password = decryptSecret(connection.encryptedPassword, this.cryptoKey());
    } catch {
      throw new BadGatewayException(
        'Não foi possível descriptografar a senha Protheus. Salve a conexão novamente.',
      );
    }

    const pathOverride =
      dto.pathOverride?.trim() ||
      this.config.get<string>(`PROTHEUS_PATH_${dto.resource.toUpperCase()}`) ||
      this.config.get<string>('PROTHEUS_PATH_CHART_OF_ACCOUNTS') ||
      undefined;

    const client = new ProtheusClient({
      baseUrl: connection.baseUrl,
      username: connection.username,
      password,
      companyCode: connection.companyCode || '01',
      branchCode: connection.branchCode || '01',
    });

    let result;
    try {
      result = await client.fetchResource(dto.resource, pathOverride);
    } catch (err) {
      throw new BadGatewayException(
        err instanceof Error ? err.message : 'Falha ao consultar Protheus',
      );
    }

    const syncJob = await this.prisma.withTenantContext(
      this.rls(actor, tenantId),
      async (tx) => {
        const job = await tx.protheusSyncJob.create({
          data: {
            tenantId,
            connectionId: connection.id,
            resource: dto.resource,
            status: SyncJobStatus.succeeded,
            startedAt: new Date(),
            finishedAt: new Date(),
            stats: {
              mode: 'sync_fetch',
              count: result.items.length,
              fetchedTotal: result.rawCountBeforeFilter ?? result.items.length,
              url: result.url,
              httpStatus: result.rawStatus,
              authMode: result.authMode ?? null,
            } as Prisma.InputJsonValue,
          },
        });

        if (result.items.length > 0) {
          await tx.protheusStagingRow.createMany({
            data: result.items.map((item) => ({
              tenantId,
              jobId: job.id,
              resource: dto.resource,
              externalId: item.externalId,
              payload: item.payload as Prisma.InputJsonValue,
            })),
            skipDuplicates: true,
          });
        }

        await tx.protheusConnection.update({
          where: { id: connection.id },
          data: { lastSyncAt: new Date() },
        });

        return job;
      },
    );

    const items = result.items
      .map((i) => ({
        externalId: i.externalId,
        ...flattenAccount(i.payload),
        raw: i.payload,
      }))
      .filter((row) => row.isActive !== false);

    await this.audit.log({
      actorId: actor.id,
      tenantId,
      action: 'protheus.fetch',
      entityType: 'protheus_sync_job',
      entityId: syncJob.id,
      metadata: {
        resource: dto.resource,
        count: items.length,
        fetched: result.items.length,
        url: result.url,
      },
    });

    return {
      jobId: syncJob.id,
      resource: dto.resource,
      url: result.url,
      count: items.length,
      fetchedTotal: result.rawCountBeforeFilter ?? result.items.length,
      authMode: result.authMode,
      items,
    };
  }

  async discoverCompanies(actor: AuthUser, tenantId?: string) {
    if (
      actor.role !== ROLES.HQ_ADMIN &&
      actor.role !== ROLES.TENANT_ADMIN &&
      actor.role !== ROLES.CONSULTANT
    ) {
      throw new ForbiddenException();
    }

    const tid = this.resolveTenantId(actor, tenantId);
    const connection = await this.prisma.withTenantContext(
      this.rls(actor, tid),
      (tx) =>
        tx.protheusConnection.findFirst({
          where: { tenantId: tid, isActive: true },
        }),
    );
    if (!connection) {
      throw new NotFoundException(
        'Conexão Protheus não configurada. Salve usuário/senha antes.',
      );
    }

    let password: string;
    try {
      password = decryptSecret(connection.encryptedPassword, this.cryptoKey());
    } catch {
      throw new BadGatewayException(
        'Não foi possível descriptografar a senha. Salve a conexão novamente.',
      );
    }

    const client = new ProtheusClient({
      baseUrl: connection.baseUrl,
      username: connection.username,
      password,
      companyCode: connection.companyCode || '01',
      branchCode: connection.branchCode || '01',
    });

    try {
      return await client.discoverCompanies();
    } catch (err) {
      throw new BadGatewayException(
        err instanceof Error ? err.message : 'Falha ao descobrir empresas',
      );
    }
  }

  async startSync(actor: AuthUser, dto: StartProtheusSyncDto) {
    if (
      actor.role !== ROLES.HQ_ADMIN &&
      actor.role !== ROLES.TENANT_ADMIN &&
      actor.role !== ROLES.CONSULTANT
    ) {
      throw new ForbiddenException();
    }

    const tenantId = this.resolveTenantId(actor, dto.tenantId);
    const connection = await this.prisma.withTenantContext(
      this.rls(actor, tenantId),
      (tx) =>
        tx.protheusConnection.findFirst({
          where: { tenantId, isActive: true },
        }),
    );
    if (!connection) {
      throw new NotFoundException('Protheus connection not configured');
    }

    const syncJob = await this.prisma.withTenantContext(
      this.rls(actor, tenantId),
      (tx) =>
        tx.protheusSyncJob.create({
          data: {
            tenantId,
            connectionId: connection.id,
            resource: dto.resource,
          },
        }),
    );

    await this.queue.add(
      'sync',
      {
        syncJobId: syncJob.id,
        tenantId,
        resource: dto.resource,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );

    await this.audit.log({
      actorId: actor.id,
      tenantId,
      action: 'protheus.sync.start',
      entityType: 'protheus_sync_job',
      entityId: syncJob.id,
      metadata: { resource: dto.resource },
    });

    return syncJob;
  }

  async listJobs(actor: AuthUser, tenantId?: string) {
    const id = this.resolveTenantId(actor, tenantId);
    return this.prisma.withTenantContext(this.rls(actor, id), (tx) =>
      tx.protheusSyncJob.findMany({
        where: { tenantId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    );
  }

  async listStaging(actor: AuthUser, resource?: string, tenantId?: string) {
    const id = this.resolveTenantId(actor, tenantId);
    return this.prisma.withTenantContext(this.rls(actor, id), (tx) =>
      tx.protheusStagingRow.findMany({
        where: {
          tenantId: id,
          ...(resource ? { resource } : {}),
        },
        orderBy: { syncedAt: 'desc' },
        take: 200,
      }),
    );
  }
}

function flattenAccount(payload: Record<string, unknown>) {
  const code = String(
    payload.CT1_CONTA ??
      payload.ct1_conta ??
      payload.account ??
      payload.conta ??
      payload.codigo ??
      payload.code ??
      '',
  );
  const name = String(
    payload.CT1_DESC01 ??
      payload.ct1_desc01 ??
      payload.description ??
      payload.descricao ??
      payload.nome ??
      payload.name ??
      '',
  );
  const classType = String(
    payload.CT1_CLASSE ??
      payload.ct1_classe ??
      payload.CLASSE ??
      payload.classe ??
      payload.class ??
      payload.classType ??
      '',
  );

  // CT1_BLOQ: 1 = Bloqueada, 2 = Ativa (padrão Protheus)
  const bloq = String(
    payload.CT1_BLOQ ??
      payload.ct1_bloq ??
      payload.BLOQ ??
      payload.bloq ??
      payload.blocked ??
      '',
  )
    .trim()
    .toUpperCase();
  const deleted = String(
    payload.D_E_L_E_T_ ?? payload.DELETED ?? payload.deleted ?? '',
  ).trim();

  const isBlocked =
    bloq === '1' ||
    bloq === 'S' ||
    bloq === 'SIM' ||
    bloq === 'BLOQUEADA' ||
    bloq === 'BLOQ' ||
    bloq === 'TRUE';
  const isDeleted = deleted === '*' || deleted === '1' || deleted === 'T';

  return {
    code,
    name,
    classType,
    blocked: isBlocked,
    isActive: !isBlocked && !isDeleted,
  };
}
