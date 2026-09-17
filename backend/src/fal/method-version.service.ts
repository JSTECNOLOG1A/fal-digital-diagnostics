import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';

/**
 * Somente leitura por ora — publicar/editar MethodVersion (dimensions/
 * crossings) é uma tela de administração à parte (MethodAdmin.jsx),
 * fora do escopo do Marco 1 (Assessment/questionário/MQE/copiloto).
 */
@Injectable()
export class MethodVersionService {
  constructor(private readonly prisma: PrismaService) {}

  private rlsOpts(actor: AuthUser) {
    return { tenantId: actor.tenantId, isHq: isHQ(actor.role) };
  }

  async list(actor: AuthUser, status?: string) {
    const where: Prisma.MethodVersionWhereInput = {
      deletedAt: null,
      // HQ enxerga todas as tenant_id (mesmo padrão de AssessmentService/
      // ActionPlanService etc.) — antes disso, um hq_admin sem tenantId no
      // JWT (o caso normal) só via MethodVersions globais (tenant_id NULL),
      // nunca as de um tenant específico, mesmo estando "dentro" dele via
      // X-Tenant-Id no frontend.
      ...(isHQ(actor.role) ? {} : { OR: [{ tenantId: actor.tenantId }, { tenantId: null }] }),
    };
    if (status === 'active') where.isPublished = true;
    if (status === 'draft') where.isPublished = false;
    // method_versions tem FORCE ROW LEVEL SECURITY — sem withTenantContext
    // (que faz SET LOCAL app.is_hq/app.tenant_id dentro da transação), o
    // filtro acima nunca chegava a importar: o Postgres já descartava toda
    // linha tenant-scoped antes mesmo da query, para HQ e tenant igual.
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.methodVersion.findMany({ where, orderBy: { createdAt: 'desc' } }),
    );
  }

  async get(actor: AuthUser, id: string) {
    const mv = await this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.methodVersion.findUnique({ where: { id } }),
    );
    if (!mv) throw new NotFoundException('MethodVersion not found');
    return mv;
  }
}
