import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { rlsStorage } from '../common/interceptors/tenant-rls.interceptor';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    actorId?: string | null;
    tenantId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Prisma.InputJsonValue;
    ipAddress?: string;
  }) {
    const als = rlsStorage.getStore();
    return this.prisma.withTenantContext(
      {
        tenantId: input.tenantId ?? als?.tenantId ?? null,
        isHq: als?.isHq ?? !input.tenantId,
      },
      (tx) =>
        tx.auditLog.create({
          data: {
            actorId: input.actorId ?? null,
            tenantId: input.tenantId ?? null,
            action: input.action,
            entityType: input.entityType,
            entityId: input.entityId ?? null,
            metadata: input.metadata,
            ipAddress: input.ipAddress,
          },
        }),
    );
  }
}
