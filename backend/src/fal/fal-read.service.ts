import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';

/**
 * Leituras cross-assessment dos artefatos do motor de scoring (Marco 2) —
 * as telas legadas leem essas entidades diretamente via
 * base44.entities.FalDiagnosticSnapshot/.FalAggregateSnapshot/
 * .SystemicCrossingAnalysis/.SystemicDimensionImpact.filter(...), sem passar
 * pelas funções de cálculo. Os cálculos em si (create/update) só acontecem
 * via FalDiagnosticService/MfisService/FalAggregateService.
 */
@Injectable()
export class FalReadService {
  constructor(private readonly prisma: PrismaService) {}

  private rlsOpts(actor: AuthUser) {
    return { tenantId: actor.tenantId, isHq: isHQ(actor.role) };
  }

  async listDiagnosticSnapshots(
    actor: AuthUser,
    query: { assessmentId?: string; targetType?: string; targetId?: string; limit?: number },
  ) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) => {
      const where: Prisma.FalDiagnosticSnapshotWhereInput = isHQ(actor.role) ? {} : { tenantId: actor.tenantId! };
      if (query.assessmentId) where.assessmentId = query.assessmentId;
      if (query.targetType) where.targetType = query.targetType;
      if (query.targetId) where.targetId = query.targetId;
      return tx.falDiagnosticSnapshot.findMany({
        where,
        orderBy: { computedAt: 'desc' },
        take: query.limit && query.limit > 0 ? query.limit : 50,
      });
    });
  }

  async getDiagnosticSnapshot(actor: AuthUser, id: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.falDiagnosticSnapshot.findFirst({ where: { id } }),
    );
  }

  async listAggregateSnapshots(
    actor: AuthUser,
    query: { levelType?: string; levelId?: string; limit?: number },
  ) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) => {
      const where: Prisma.FalAggregateSnapshotWhereInput = isHQ(actor.role) ? {} : { tenantId: actor.tenantId! };
      if (query.levelType) where.levelType = query.levelType;
      if (query.levelId) where.levelId = query.levelId;
      return tx.falAggregateSnapshot.findMany({
        where,
        orderBy: { computedAt: 'desc' },
        take: query.limit && query.limit > 0 ? query.limit : 500,
      });
    });
  }

  async listSystemicCrossings(actor: AuthUser, assessmentId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.systemicCrossingAnalysis.findMany({
        where: { assessmentId },
        orderBy: { tensionRank: 'asc' },
      }),
    );
  }

  async listSystemicDimensionImpacts(actor: AuthUser, assessmentId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.systemicDimensionImpact.findMany({ where: { assessmentId } }),
    );
  }

  async listActionTaskReviews(actor: AuthUser, taskId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.actionTaskReview.findMany({ where: { actionTaskId: taskId }, orderBy: { createdAt: 'desc' } }),
    );
  }

  async listActionTaskActivities(actor: AuthUser, taskId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), (tx) =>
      tx.actionTaskActivity.findMany({ where: { actionTaskId: taskId }, orderBy: { timestamp: 'desc' } }),
    );
  }
}
