import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { UpsertFalResponseDto } from './dto/fal.dto';
import { AssessmentFlowService } from './assessment-flow.service';

@Injectable()
export class FalResponseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flow: AssessmentFlowService,
  ) {}

  private rlsOpts(actor: AuthUser) {
    return { tenantId: actor.tenantId, isHq: isHQ(actor.role) };
  }

  async listByAssessment(actor: AuthUser, assessmentId: string, dimensionKey?: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const assessment = await tx.assessment.findFirst({ where: { id: assessmentId } });
      if (!assessment) throw new NotFoundException('Assessment not found');
      if (!isHQ(actor.role) && assessment.tenantId !== actor.tenantId) {
        throw new ForbiddenException('Tenant scope violation');
      }
      return tx.falResponse.findMany({
        where: { assessmentId, ...(dimensionKey ? { dimensionKey } : {}) },
        orderBy: { dimensionKey: 'asc' },
      });
    });
  }

  /** Cria uma resposta nova (persistAnswers cria quando ans.id ainda não existe). */
  async create(actor: AuthUser, dto: UpsertFalResponseDto) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const assessment = await tx.assessment.findFirst({ where: { id: dto.assessmentId } });
      if (!assessment) throw new NotFoundException('Assessment not found');
      const tenantId = isHQ(actor.role) ? assessment.tenantId : actor.tenantId!;
      if (assessment.tenantId !== tenantId) {
        throw new ForbiddenException('Tenant scope violation');
      }
      await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', $1, true)`, tenantId);
      const created = await tx.falResponse.create({
        data: {
          tenantId,
          assessmentId: dto.assessmentId,
          falQuestionId: dto.falQuestionId,
          dimensionKey: dto.dimensionKey,
          subdimensionKey: dto.subdimensionKey,
          clusterKey: dto.clusterKey,
          score: dto.score,
          justification: dto.justification,
          confidenceLevel: dto.confidenceLevel ?? 'auto_declarada',
          flag: dto.flag,
          evidenceNotes: dto.evidenceNotes,
          evidenceFileUrls: dto.evidenceFileUrls ?? [],
          evaluatedEntityId: dto.evaluatedEntityId,
          evaluatedEntityType: dto.evaluatedEntityType,
        },
      });
      // Porta de onFalResponseChange — nova resposta é sempre "mudança relevante".
      await this.flow.onFalResponseChanged(tx, dto.assessmentId, tenantId);
      return created;
    });
  }

  async update(actor: AuthUser, id: string, dto: Partial<UpsertFalResponseDto>) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const existing = await tx.falResponse.findFirst({ where: { id } });
      if (!existing) throw new NotFoundException('FalResponse not found');
      if (!isHQ(actor.role) && existing.tenantId !== actor.tenantId) {
        throw new ForbiddenException('Tenant scope violation');
      }
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, true)`,
        existing.tenantId,
      );
      const isMeaningfulChange =
        (dto.score !== undefined && dto.score !== existing.score) ||
        (dto.justification !== undefined && dto.justification !== existing.justification) ||
        (dto.confidenceLevel !== undefined && dto.confidenceLevel !== existing.confidenceLevel) ||
        (dto.evidenceNotes !== undefined && (dto.evidenceNotes || '') !== (existing.evidenceNotes || ''));

      const updated = await tx.falResponse.update({
        where: { id },
        data: {
          ...(dto.score !== undefined && { score: dto.score }),
          ...(dto.justification !== undefined && { justification: dto.justification }),
          ...(dto.confidenceLevel !== undefined && { confidenceLevel: dto.confidenceLevel }),
          ...(dto.flag !== undefined && { flag: dto.flag }),
          ...(dto.evidenceNotes !== undefined && { evidenceNotes: dto.evidenceNotes }),
          ...(dto.evidenceFileUrls !== undefined && { evidenceFileUrls: dto.evidenceFileUrls }),
        },
      });
      // Porta de onFalResponseChange — pula update idempotente (mesmos valores re-salvos).
      if (isMeaningfulChange) {
        await this.flow.onFalResponseChanged(tx, existing.assessmentId, existing.tenantId);
      }
      return updated;
    });
  }
}
