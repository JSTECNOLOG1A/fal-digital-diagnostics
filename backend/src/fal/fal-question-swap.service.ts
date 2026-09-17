import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';

type QuestionLite = {
  id: string;
  dimensionKey: string;
  subdimensionKey: string;
  clusterKey: string;
  levelApplicability: string[];
  questionWeight: Prisma.Decimal;
  questionText: string;
  diagnosticDepth: string[];
};

/// Espelha DIMENSION_APPLICABILITY do base44 original — quais dimensões se
/// aplicam a cada nível hierárquico (group/company/unit).
const DIMENSION_APPLICABILITY: Record<string, Record<string, boolean>> = {
  group: { governanca: true, juridico: true, controles_internos: false, financeiro: false, contabil: false, tributario: false, operacional: false, sistemas: false },
  company: { governanca: true, juridico: true, controles_internos: true, financeiro: true, contabil: true, tributario: true, operacional: true, sistemas: true },
  unit: { governanca: false, juridico: false, controles_internos: true, financeiro: true, contabil: true, tributario: true, operacional: true, sistemas: true },
};

function isQuestionApplicable(question: QuestionLite, targetType: string): boolean {
  if (!DIMENSION_APPLICABILITY[targetType]?.[question.dimensionKey]) return false;
  const levels = question.levelApplicability?.length ? question.levelApplicability : ['group', 'company', 'unit'];
  if (!levels.includes(targetType)) return false;
  // unit_type_applicability / sector_applicability: campos nunca existiram no
  // schema real do FalQuestion (nem no base44 original — ver auditoria), logo
  // esses filtros do original eram sempre no-op; omitidos aqui de propósito.
  return true;
}

function pickCandidate(pool: QuestionLite[], excluded: Set<string>): QuestionLite | null {
  const sorted = pool
    .filter((q) => !excluded.has(q.id))
    .sort((a, b) => Number(b.questionWeight ?? 1) - Number(a.questionWeight ?? 1));
  return sorted[0] ?? null;
}

@Injectable()
export class FalQuestionSwapService {
  constructor(private readonly prisma: PrismaService) {}

  private rlsOpts(actor: AuthUser) {
    return { tenantId: actor.tenantId, isHq: isHQ(actor.role) };
  }

  /** Porta de base44/functions/swapFalQuestion. Apenas hq_admin. */
  async swap(
    actor: AuthUser,
    assessmentId: string,
    originalQuestionId: string,
    swapReason: string,
    swapReasonLabel?: string,
  ) {
    if (!isHQ(actor.role)) throw new ForbiddenException('HQ admin only');

    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const assessment = await tx.assessment.findFirst({ where: { id: assessmentId } });
      if (!assessment) throw new NotFoundException('Assessment não encontrado');

      const currentSet = assessment.questionSet || [];
      if (!currentSet.includes(originalQuestionId)) {
        throw new BadRequestException('Pergunta não encontrada no question_set deste assessment');
      }

      const existingSwaps = await tx.falQuestionSwap.findMany({ where: { assessmentId } });
      const alreadySwapped = existingSwaps.find((s) => s.originalQuestionId === originalQuestionId);
      if (alreadySwapped) {
        throw new ConflictException({
          message: 'Esta pergunta já foi substituída anteriormente. Não é permitido substituir uma pergunta mais de uma vez.',
          swap_record: alreadySwapped,
        });
      }

      const swappedOutIds = new Set(existingSwaps.map((s) => s.originalQuestionId));
      const replacementIds = new Set(existingSwaps.map((s) => s.replacementQuestionId));

      const originalQuestion = await tx.falQuestion.findUnique({ where: { id: originalQuestionId } });
      if (!originalQuestion) throw new NotFoundException('Pergunta original não encontrada no banco');

      const targetType = assessment.targetType || 'company';

      const allQuestions = await tx.falQuestion.findMany();

      const dimKey = originalQuestion.dimensionKey;
      const subdimKey = originalQuestion.subdimensionKey;
      const clusterKey = originalQuestion.clusterKey;

      const eligiblePool = allQuestions.filter(
        (q) => q.id !== originalQuestionId && q.dimensionKey === dimKey && isQuestionApplicable(q, targetType),
      );

      const excluded = new Set([...currentSet, ...swappedOutIds, ...replacementIds]);

      let candidate: QuestionLite | null = null;
      let fallbackLevel: string | null = null;

      if (clusterKey) {
        const clusterPool = eligiblePool.filter((q) => q.clusterKey === clusterKey);
        candidate = pickCandidate(clusterPool, excluded);
        if (candidate) fallbackLevel = 'cluster';
      }

      if (!candidate && subdimKey) {
        const subdimPool = eligiblePool.filter((q) => q.subdimensionKey === subdimKey);
        candidate = pickCandidate(subdimPool, excluded);
        if (candidate) fallbackLevel = 'subdimension';
      }

      if (!candidate) {
        candidate = pickCandidate(eligiblePool, excluded);
        if (candidate) fallbackLevel = 'dimension';
      }

      if (!candidate) {
        throw new UnprocessableEntityException({
          message: 'Não há pergunta substituta disponível para esta pergunta no momento. Todas as perguntas elegíveis da dimensão já estão no questionário ou foram utilizadas como substitutas.',
          original_question_id: originalQuestionId,
          dimension: dimKey,
          subdimension: subdimKey,
          cluster: clusterKey,
        });
      }

      const newQuestionSet = currentSet.map((id) => (id === originalQuestionId ? candidate!.id : id));

      await tx.assessment.update({ where: { id: assessmentId }, data: { questionSet: newQuestionSet } });

      const swapRecord = await tx.falQuestionSwap.create({
        data: {
          tenantId: assessment.tenantId,
          assessmentId,
          originalQuestionId,
          replacementQuestionId: candidate.id,
          dimensionKey: dimKey,
          subdimensionKey: subdimKey || null,
          clusterKey: clusterKey || null,
          swapReason,
          swapReasonLabel: swapReasonLabel || swapReason,
          fallbackLevel,
          swappedBy: actor.email,
        },
      });

      return {
        success: true,
        original_question_id: originalQuestionId,
        replacement_question_id: candidate.id,
        replacement_question: {
          id: candidate.id,
          question_text: candidate.questionText,
          dimension_key: candidate.dimensionKey,
          subdimension_key: candidate.subdimensionKey,
          cluster_key: candidate.clusterKey,
          question_weight: Number(candidate.questionWeight ?? 1),
          diagnostic_depth: candidate.diagnosticDepth?.[0] || 'rapid',
        },
        fallback_level: fallbackLevel,
        swap_record: swapRecord,
      };
    });
  }
}
