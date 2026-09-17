import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';

type ScopeTarget = {
  entity_id?: string;
  level?: string;
  entity_name?: string;
  weight?: number;
  sampling_mode?: string;
  include_in_consolidated_score?: boolean;
};

/** Hash inline (mesmo algoritmo djb2-variant do base44 original) — só serve para detectar mudança de configuração, não é criptográfico. */
function buildScopeHash(mapping: Record<string, ScopeTarget[]>): string {
  if (!mapping) return '';
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(mapping).sort()) {
    sorted[key] = [...(mapping[key] || [])]
      .sort((a, b) => (a.entity_id || '').localeCompare(b.entity_id || ''))
      .map((t) => ({
        entity_id: t.entity_id,
        level: t.level,
        sampling_mode: t.sampling_mode,
        include_in_consolidated_score: t.include_in_consolidated_score,
      }));
  }
  const str = JSON.stringify(sorted);
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

@Injectable()
export class AssessmentScopeService {
  constructor(private readonly prisma: PrismaService) {}

  private rlsOpts(actor: AuthUser) {
    return { tenantId: actor.tenantId, isHq: isHQ(actor.role) };
  }

  /** Porta de base44/functions/generateAssessmentScopes. Idempotente. */
  async generate(actor: AuthUser, assessmentId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const assessment = await tx.assessment.findFirst({ where: { id: assessmentId } });
      if (!assessment) throw new NotFoundException('Assessment not found');
      if (!isHQ(actor.role) && actor.tenantId && assessment.tenantId !== actor.tenantId) {
        throw new ForbiddenException('Forbidden');
      }

      if (assessment.assessmentMode !== 'multi_entity_master') {
        throw new BadRequestException({
          message: 'Este Assessment não é do tipo multi_entity_master.',
          mode: assessment.assessmentMode,
        });
      }

      const metadata = (assessment.metadata as Record<string, unknown>) ?? {};
      const mapping = metadata.dimension_target_mapping as Record<string, ScopeTarget[]> | undefined;
      if (!mapping || typeof mapping !== 'object') {
        throw new BadRequestException('dimension_target_mapping ausente ou inválido.');
      }

      const existingScopes = await tx.assessmentScope.findMany({ where: { assessmentId } });
      const scopeIndex = new Map(existingScopes.map((s) => [`${s.dimensionKey}::${s.evaluatedEntityId}`, s]));

      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (const [dimKey, targets] of Object.entries(mapping)) {
        if (!Array.isArray(targets)) continue;

        for (const target of targets) {
          const entityId = target.entity_id;
          if (!entityId) continue;

          const scopeKey = `${dimKey}::${entityId}`;
          const existing = scopeIndex.get(scopeKey);

          const evaluatedEntityType = target.level ?? '';
          const evaluatedEntityName = target.entity_name || '';
          const weight = new Prisma.Decimal(target.weight ?? 1);
          const samplingMode = target.sampling_mode || 'full';
          const includeInConsolidatedScore = target.include_in_consolidated_score !== false;

          if (!existing) {
            await tx.assessmentScope.create({
              data: {
                tenantId: assessment.tenantId,
                assessmentId,
                dimensionKey: dimKey,
                evaluatedEntityType,
                evaluatedEntityId: entityId,
                evaluatedEntityName,
                weight,
                samplingMode,
                includeInConsolidatedScore,
                status: 'not_started',
                questionCount: 0,
                answeredCount: 0,
                requiredCount: 0,
                completionRatio: new Prisma.Decimal(0),
              },
            });
            createdCount++;
          } else {
            const hasChange =
              existing.evaluatedEntityType !== evaluatedEntityType ||
              existing.evaluatedEntityName !== evaluatedEntityName ||
              !existing.weight.equals(weight) ||
              existing.samplingMode !== samplingMode ||
              existing.includeInConsolidatedScore !== includeInConsolidatedScore;

            if (hasChange) {
              await tx.assessmentScope.update({
                where: { id: existing.id },
                data: { evaluatedEntityType, evaluatedEntityName, weight, samplingMode, includeInConsolidatedScore },
              });
              updatedCount++;
            } else {
              skippedCount++;
            }
          }
        }
      }

      const scopeHash = buildScopeHash(mapping);
      await tx.assessment.update({
        where: { id: assessmentId },
        data: { metadata: { ...metadata, scope_hash: scopeHash, configuration_status: 'configured' } as Prisma.InputJsonValue },
      });

      return {
        success: true,
        created_count: createdCount,
        updated_count: updatedCount,
        skipped_count: skippedCount,
        total: createdCount + updatedCount + skippedCount,
      };
    });
  }

  async list(actor: AuthUser, assessmentId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const assessment = await tx.assessment.findFirst({ where: { id: assessmentId } });
      if (!assessment) throw new NotFoundException('Assessment not found');
      if (!isHQ(actor.role) && actor.tenantId && assessment.tenantId !== actor.tenantId) {
        throw new ForbiddenException('Forbidden');
      }
      return tx.assessmentScope.findMany({ where: { assessmentId }, orderBy: { dimensionKey: 'asc' } });
    });
  }
}
