import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { UpsertMQEResponseDto } from './dto/fal.dto';

@Injectable()
export class MqeService {
  constructor(private readonly prisma: PrismaService) {}

  private rlsOpts(actor: AuthUser) {
    return { tenantId: actor.tenantId, isHq: isHQ(actor.role) };
  }

  /** Banco global de perguntas de cruzamento — sem tenant_id. */
  async listQuestions(methodVersionId: string, crossingKey?: string) {
    return this.prisma.mQEQuestion.findMany({
      where: { methodVersionId, ...(crossingKey ? { crossingKey } : {}) },
      orderBy: { order: 'asc' },
    });
  }

  async listResponses(actor: AuthUser, assessmentId: string, crossingKey?: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const assessment = await tx.assessment.findFirst({ where: { id: assessmentId } });
      if (!assessment) throw new NotFoundException('Assessment not found');
      if (!isHQ(actor.role) && assessment.tenantId !== actor.tenantId) {
        throw new ForbiddenException('Tenant scope violation');
      }
      return tx.mQEResponse.findMany({
        where: { assessmentId, ...(crossingKey ? { crossingKey } : {}) },
      });
    });
  }

  async create(actor: AuthUser, dto: UpsertMQEResponseDto) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const assessment = await tx.assessment.findFirst({ where: { id: dto.assessmentId } });
      if (!assessment) throw new NotFoundException('Assessment not found');
      const tenantId = isHQ(actor.role) ? assessment.tenantId : actor.tenantId!;
      if (assessment.tenantId !== tenantId) {
        throw new ForbiddenException('Tenant scope violation');
      }
      await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', $1, true)`, tenantId);
      return tx.mQEResponse.create({
        data: {
          tenantId,
          assessmentId: dto.assessmentId,
          mqeQuestionId: dto.mqeQuestionId,
          crossingKey: dto.crossingKey,
          score: dto.score,
          justification: dto.justification,
          divergenceNotes: dto.divergenceNotes,
        },
      });
    });
  }

  async update(actor: AuthUser, id: string, dto: Partial<UpsertMQEResponseDto>) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const existing = await tx.mQEResponse.findFirst({ where: { id } });
      if (!existing) throw new NotFoundException('MQEResponse not found');
      if (!isHQ(actor.role) && existing.tenantId !== actor.tenantId) {
        throw new ForbiddenException('Tenant scope violation');
      }
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, true)`,
        existing.tenantId,
      );
      return tx.mQEResponse.update({
        where: { id },
        data: {
          ...(dto.score !== undefined && { score: dto.score }),
          ...(dto.justification !== undefined && { justification: dto.justification }),
          ...(dto.divergenceNotes !== undefined && { divergenceNotes: dto.divergenceNotes }),
        },
      });
    });
  }
}
