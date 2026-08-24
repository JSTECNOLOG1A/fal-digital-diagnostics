import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { rlsStorage } from '../common/interceptors/tenant-rls.interceptor';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Aplica session vars RLS em transação (SET LOCAL via is_local=true).
   * Preferir este wrapper para leituras/escritas em tabelas com FORCE RLS.
   */
  async withTenantContext<T>(
    opts: { tenantId: string | null; isHq: boolean } | undefined,
    fn: (tx: PrismaClient) => Promise<T>,
  ): Promise<T> {
    const als = rlsStorage.getStore();
    const resolved = opts ?? {
      tenantId: als?.tenantId ?? null,
      isHq: als?.isHq ?? false,
    };

    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.is_hq', $1, true)`,
        resolved.isHq ? 'true' : 'false',
      );
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, true)`,
        resolved.tenantId ?? '',
      );
      return fn(tx as unknown as PrismaClient);
    });
  }

  /** Atalho: usa AsyncLocalStorage do request atual. */
  runWithRls<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return this.withTenantContext(undefined, fn);
  }
}
