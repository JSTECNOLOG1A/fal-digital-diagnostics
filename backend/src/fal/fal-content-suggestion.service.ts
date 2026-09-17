import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { AssessmentService } from './assessment.service';
import { GenerateFalContentSuggestionDto, ReviewFalContentSuggestionDto } from './dto/fal.dto';

const RATING_TEXT: Record<number, { verb: string; tone: string }> = {
  0: { verb: 'Estruturar', tone: 'apresentou maturidade crítica' },
  1: { verb: 'Corrigir fragilidades em', tone: 'indica existência parcial da rotina, com falhas relevantes' },
  2: { verb: 'Aprimorar', tone: 'possui funcionamento razoável, mas pode evoluir' },
  3: { verb: 'Manter monitoramento de', tone: 'apresenta maturidade satisfatória' },
};
const GAP_BY_SCORE: Record<number, number | null> = { 0: 0, 1: 1, 2: 2, 3: null };
const TYPE_BY_SCORE: Record<number, string> = {
  0: 'structural',
  1: 'corrective',
  2: 'improvement',
  3: 'monitoring',
};
const TIMEFRAME_BY_SCORE: Record<number, string> = {
  0: '180d',
  1: '90d',
  2: '60d',
  3: '180d',
};

@Injectable()
export class FalContentSuggestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assessments: AssessmentService,
  ) {}

  /** Fila de revisão — biblioteca global, sem RLS de tenant. */
  async listPending(contentType?: string) {
    return this.prisma.falContentSuggestion.findMany({
      where: { status: 'pending', ...(contentType ? { contentType } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async generate(actor: AuthUser, dto: GenerateFalContentSuggestionDto) {
    const contentType = dto.contentType === 'recommendation' ? 'recommendation' : 'question';
    const requestedBy = dto.requestedBy || actor.email || actor.id;

    const existing = await this.prisma.falQuestion.findMany({
      where: { clusterKey: dto.clusterKey },
      orderBy: { sequenceOrder: 'asc' },
    });
    if (existing.length === 0) {
      throw new BadRequestException(
        `Nenhuma pergunta existente encontrada para clusterKey="${dto.clusterKey}".`,
      );
    }
    const { dimensionKey, subdimensionKey } = existing[0];

    if (contentType === 'recommendation') {
      const score = dto.triggerScore;
      if (score === undefined || ![0, 1, 2, 3].includes(score)) {
        throw new BadRequestException(
          'triggerScore é obrigatório e deve ser 0, 1, 2 ou 3 para contentType="recommendation".',
        );
      }
      const current = await this.prisma.falRecommendationLibrary.findFirst({
        where: { clusterKey: dto.clusterKey, triggerScore: score },
      });
      const clusterLabel = dto.clusterKey.replace(/_cluster$/, '').replace(/_/g, ' ');
      const rating = RATING_TEXT[score];
      const draftPayload = {
        recommendation_key: current?.recommendationKey || `fal_rec_${dto.clusterKey}_r${score}_ia`,
        source: 'global_library',
        source_type: 'cluster_rating',
        dimension_key: dimensionKey,
        subdimension_key: subdimensionKey,
        cluster_key: dto.clusterKey,
        question_id: null,
        trigger_score: score,
        gap_level: GAP_BY_SCORE[score],
        is_actionable: score !== 3,
        recommendation_type: TYPE_BY_SCORE[score],
        recommendation_title: `${rating.verb} ${clusterLabel} (rascunho local)`,
        recommendation_description: `O cluster "${clusterLabel}" ${rating.tone}. [Rascunho gerado por fallback template — revisar e detalhar antes de aprovar.]`,
        implementation_steps: [
          'Revisar este texto (gerado por fallback local, não IA real)',
          'Detalhar passos específicos do processo',
          'Definir responsável e prazo',
        ],
        evidence_required: 'A definir na revisão.',
        success_indicators: 'A definir na revisão.',
        routine_template: `Checklist periódico para ${clusterLabel}.`,
        effort_level: 3,
        impact_level: score === 0 ? 5 : score === 1 ? 4 : score === 2 ? 3 : 2,
        priority_weight: score === 0 ? 90 : score === 1 ? 75 : score === 2 ? 50 : 20,
        typical_owner: current?.typicalOwner || '',
        estimated_timeframe: TIMEFRAME_BY_SCORE[score],
        cluster_question_count: existing.length,
        tenant_id: 'global',
        version: current ? `${(parseFloat(current.version) || 1) + 0.1}` : '1.0',
        notes: 'Gerado via copiloto de IA (fallback local) — revisar antes de publicar.',
        is_active: true,
      };
      const suggestion = await this.prisma.falContentSuggestion.create({
        data: {
          tenantId: null,
          contentType: 'recommendation',
          dimensionKey,
          subdimensionKey,
          clusterKey: dto.clusterKey,
          trigger: 'manual',
          requestedBy,
          modelUsed: 'local-fallback-template',
          promptContextSummary: current
            ? `Substitui recomendação atual "${current.recommendationTitle}" (fallback local).`
            : 'Nova recomendação (fallback local).',
          draftPayload,
          status: 'pending',
        },
      });
      return {
        success: true,
        createdCount: 1,
        suggestions: [
          { ...suggestion, rationale: 'Rascunho local (sem LLM real) — texto genérico proposital, detalhar na revisão.' },
        ],
      };
    }

    const count = Math.min(dto.count ?? 3, 8);
    const created = await this.assessments.generateQuestionSuggestions(this.prisma, {
      clusterKey: dto.clusterKey,
      dimensionKey,
      subdimensionKey,
      existingCount: existing.length,
      count,
      requestedBy,
      trigger: 'manual',
    });
    return { success: true, createdCount: created.length, suggestions: created };
  }

  async review(actor: AuthUser, id: string, dto: ReviewFalContentSuggestionDto) {
    const suggestion = await this.prisma.falContentSuggestion.findUnique({ where: { id } });
    if (!suggestion) throw new NotFoundException('Sugestão não encontrada');
    if (suggestion.status !== 'pending') {
      throw new BadRequestException(`Sugestão já revisada (status atual: ${suggestion.status})`);
    }

    const reviewedBy = actor.email || actor.id;

    if (dto.action === 'reject') {
      await this.prisma.falContentSuggestion.update({
        where: { id },
        data: {
          status: 'rejected',
          reviewedBy,
          reviewedAt: new Date(),
          reviewComment: dto.comment || '',
        },
      });
      return { success: true, status: 'rejected' };
    }

    const draft = suggestion.draftPayload as Record<string, any>;
    const finalPayload = { ...draft, ...(dto.editedPayload || {}) };
    const wasEdited = !!dto.editedPayload && Object.keys(dto.editedPayload).length > 0;
    let publishedId: string | null = null;

    if (suggestion.contentType === 'question') {
      const createdQ = await this.prisma.falQuestion.create({
        data: {
          questionId: finalPayload.question_id,
          dimensionKey: finalPayload.dimension_key,
          subdimensionKey: finalPayload.subdimension_key,
          clusterKey: finalPayload.cluster_key,
          processStage: finalPayload.process_stage,
          sequenceOrder: finalPayload.sequence_order ?? 0,
          diagnosticDepth: finalPayload.diagnostic_depth ?? [],
          levelApplicability: finalPayload.level_applicability ?? [],
          questionWeight: finalPayload.question_weight ?? 1,
          questionText: finalPayload.question_text,
          guidance: finalPayload.guidance || null,
          evidenceHint: finalPayload.evidence_hint || null,
          isKillerQuestion: !!finalPayload.is_killer_question,
          isCritical: !!finalPayload.is_critical,
          dependency: finalPayload.dependency || null,
        },
      });
      publishedId = createdQ.id;
    } else if (suggestion.contentType === 'recommendation') {
      const existingRec = await this.prisma.falRecommendationLibrary.findUnique({
        where: { recommendationKey: finalPayload.recommendation_key },
      });
      const data: Prisma.FalRecommendationLibraryCreateInput = {
        recommendationKey: finalPayload.recommendation_key,
        source: finalPayload.source || null,
        sourceType: finalPayload.source_type || null,
        dimensionKey: finalPayload.dimension_key,
        subdimensionKey: finalPayload.subdimension_key || null,
        clusterKey: finalPayload.cluster_key,
        questionId: finalPayload.question_id || null,
        triggerScore: finalPayload.trigger_score ?? null,
        gapLevel: finalPayload.gap_level ?? null,
        isActionable: finalPayload.is_actionable ?? true,
        recommendationType: finalPayload.recommendation_type || null,
        recommendationTitle: finalPayload.recommendation_title,
        recommendationDescription: finalPayload.recommendation_description || null,
        implementationSteps: finalPayload.implementation_steps ?? [],
        evidenceRequired: finalPayload.evidence_required || null,
        successIndicators: finalPayload.success_indicators || null,
        routineTemplate: finalPayload.routine_template || null,
        effortLevel: finalPayload.effort_level ?? null,
        impactLevel: finalPayload.impact_level ?? null,
        priorityWeight: finalPayload.priority_weight ?? null,
        typicalOwner: finalPayload.typical_owner || null,
        estimatedTimeframe: finalPayload.estimated_timeframe || null,
        clusterQuestionCount: finalPayload.cluster_question_count ?? null,
        tenantId: finalPayload.tenant_id || 'global',
        version: String(finalPayload.version ?? '1.0'),
        notes: finalPayload.notes || null,
        isActive: finalPayload.is_active ?? true,
      };
      if (existingRec) {
        const updated = await this.prisma.falRecommendationLibrary.update({
          where: { id: existingRec.id },
          data,
        });
        publishedId = updated.id;
      } else {
        const created = await this.prisma.falRecommendationLibrary.create({ data });
        publishedId = created.id;
      }
    } else {
      throw new BadRequestException(
        `Publicação para contentType="${suggestion.contentType}" ainda não implementada`,
      );
    }

    await this.prisma.falContentSuggestion.update({
      where: { id },
      data: {
        status: wasEdited ? 'edited_approved' : 'approved',
        reviewedBy,
        reviewedAt: new Date(),
        reviewComment: dto.comment || '',
        publishedEntityId: publishedId,
      },
    });
    return {
      success: true,
      status: wasEdited ? 'edited_approved' : 'approved',
      publishedEntityId: publishedId,
    };
  }
}
