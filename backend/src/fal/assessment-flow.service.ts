import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';

const STEP_ORDER = ['diagnostic', 'priorities', 'intelligence', 'action_plan', 'simulation', 'report'] as const;
type StepKey = (typeof STEP_ORDER)[number];

const STEP_DEPENDS_ON: Record<StepKey, StepKey | null> = {
  diagnostic: null,
  priorities: null,
  intelligence: 'priorities',
  action_plan: 'intelligence',
  simulation: 'action_plan',
  report: 'action_plan',
};

function buildStepEntry(key: StepKey, flowState: any, responseVersion: number) {
  const status = flowState[`${key}Status`] || 'not_started';
  const generatedAt = flowState[`${key}GeneratedAt`] || null;
  const dependsOn = STEP_DEPENDS_ON[key];

  const sourceVersion = flowState.sourceResponseVersion || 0;
  const responsesChanged = status === 'done' && responseVersion > sourceVersion;
  const isStale = responsesChanged;

  let canRun = false;
  if (!dependsOn) {
    canRun = true;
  } else {
    const depStatus = flowState[`${dependsOn}Status`] || 'not_started';
    canRun = depStatus === 'done';
  }

  let message: string | null = null;
  if (isStale && generatedAt) {
    message = 'Respostas do questionário foram alteradas após esta análise. Execute novamente para atualizar.';
  } else if (status === 'not_started') {
    if (key === 'priorities') {
      message = 'Clique em "Gerar diagnóstico completo" para calcular prioridades.';
    } else {
      message = dependsOn ? `Requer "${dependsOn}" concluído primeiro.` : 'Pronto para executar.';
    }
  } else if (status === 'error') {
    message = flowState.lastErrorMessage || 'Erro na execução. Tente novamente.';
  }

  return {
    status: isStale ? 'stale' : status,
    generated_at: generatedAt,
    stale: isStale,
    can_run: canRun,
    depends_on: dependsOn,
    message,
  };
}

function computeNextBestStep(steps: Record<string, any>): string | null {
  for (const key of STEP_ORDER) {
    const s = steps[key];
    if (s.status === 'error') return key;
    if (s.status === 'not_started' && s.can_run) return key;
    if (s.status === 'stale' && s.can_run) return key;
  }
  return null;
}

@Injectable()
export class AssessmentFlowService {
  constructor(private readonly prisma: PrismaService) {}

  private rlsOpts(actor: AuthUser) {
    return { tenantId: actor.tenantId, isHq: isHQ(actor.role) };
  }

  /** Porta de base44/functions/getAssessmentFlow. */
  async getFlow(actor: AuthUser, assessmentId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const assessment = await tx.assessment.findFirst({ where: { id: assessmentId } });
      if (!assessment) throw new NotFoundException('Assessment not found');
      if (!isHQ(actor.role) && assessment.tenantId !== actor.tenantId) {
        throw new ForbiddenException('Tenant scope violation');
      }

      const responseVersion = assessment.currentResponseVersion || 0;

      const [flowStateRecord, snap, actionPlanCount] = await Promise.all([
        tx.assessmentFlowState.findUnique({ where: { assessmentId } }),
        tx.falDiagnosticSnapshot.findFirst({
          where: { assessmentId },
          orderBy: { computedAt: 'desc' },
        }),
        // ActionPlan ainda não migrado (Marco 3) — sempre 0 por ora.
        Promise.resolve(0),
      ]);

      const hasDiagnostic = !!snap?.overallScore;
      const hasPriorities = !!snap?.priorityComputedAt;
      const hasIntelligence = !!snap?.intelligenceComputedAt;
      const hasPlan = actionPlanCount > 0;
      const hasReport = false; // AssessmentReportVersion ainda não migrado (Marco 5).

      let flowState: any;
      if (!flowStateRecord) {
        flowState = await tx.assessmentFlowState.create({
          data: {
            tenantId: assessment.tenantId,
            assessmentId,
            flowVersion: 1,
            sourceResponseVersion: responseVersion,
            diagnosticStatus: hasDiagnostic ? 'done' : 'not_started',
            prioritiesStatus: hasPriorities ? 'done' : 'not_started',
            intelligenceStatus: hasIntelligence ? 'done' : 'not_started',
            actionPlanStatus: hasPlan ? 'done' : 'not_started',
            simulationStatus: 'not_started',
            reportStatus: hasReport ? 'done' : 'not_started',
            snapshotId: snap?.id ?? null,
            prioritiesSnapshotId: snap?.id ?? null,
            intelligenceSnapshotId: snap?.id ?? null,
            diagnosticGeneratedAt: snap?.computedAt ?? null,
            prioritiesGeneratedAt: snap?.priorityComputedAt ?? null,
            intelligenceGeneratedAt: snap?.intelligenceComputedAt ?? null,
          },
        });
      } else {
        flowState = { ...flowStateRecord };
        const updates: Prisma.AssessmentFlowStateUpdateInput = {};

        if (hasDiagnostic && flowState.diagnosticStatus === 'not_started') {
          updates.diagnosticStatus = 'done';
          updates.snapshotId = snap!.id;
          updates.diagnosticGeneratedAt = snap!.computedAt;
        }
        if (hasPriorities && flowState.prioritiesStatus === 'not_started') {
          updates.prioritiesStatus = 'done';
          updates.prioritiesSnapshotId = snap!.id;
          updates.prioritiesGeneratedAt = snap!.priorityComputedAt;
        }
        if (hasIntelligence && flowState.intelligenceStatus === 'not_started') {
          updates.intelligenceStatus = 'done';
          updates.intelligenceSnapshotId = snap!.id;
          updates.intelligenceGeneratedAt = snap!.intelligenceComputedAt;
        }

        const effectiveDiagnostic = (updates.diagnosticStatus as string) || flowState.diagnosticStatus;
        const effectivePriorities = (updates.prioritiesStatus as string) || flowState.prioritiesStatus;
        const effectiveIntelligence = (updates.intelligenceStatus as string) || flowState.intelligenceStatus;
        const allCoreDone =
          effectiveDiagnostic === 'done' && effectivePriorities === 'done' && effectiveIntelligence === 'done';
        if (allCoreDone && (flowState.sourceResponseVersion || 0) < responseVersion) {
          updates.sourceResponseVersion = responseVersion;
        }

        if (Object.keys(updates).length > 0) {
          Object.assign(flowState, updates);
          await tx.assessmentFlowState.update({ where: { id: flowState.id }, data: updates });
        }
      }

      const steps: Record<string, any> = {};
      for (const key of STEP_ORDER) {
        steps[key] = buildStepEntry(key, flowState, responseVersion);
      }
      const nextBestStep = computeNextBestStep(steps);
      const isComplete = STEP_ORDER.every((k) => steps[k].status === 'done');

      if (flowState.nextBestStep !== nextBestStep) {
        await tx.assessmentFlowState.update({
          where: { id: flowState.id },
          data: { nextBestStep },
        });
      }

      return {
        ok: true,
        assessment,
        flow_state: flowState,
        steps,
        next_best_step: nextBestStep,
        is_complete: isComplete,
        stale_from_step: flowState.staleFromStep || null,
        response_version: responseVersion,
      };
    });
  }

  /**
   * Porta de base44/functions/onFalResponseChange — chamado a partir de
   * FalResponseService após create/update de uma FalResponse com mudança
   * relevante (novo registro OU score/justification/confidence/evidence
   * diferentes). Incrementa a versão de resposta do assessment e marca
   * toda a esteira posterior como "stale".
   */
  async onFalResponseChanged(tx: PrismaClient, assessmentId: string, tenantId: string) {
    const assessment = await tx.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) return;
    const newVersion = (assessment.currentResponseVersion || 0) + 1;
    await tx.assessment.update({
      where: { id: assessmentId },
      data: { currentResponseVersion: newVersion },
    });

    const staleUpdate = {
      staleFromStep: 'diagnostic',
      diagnosticStatus: 'stale',
      prioritiesStatus: 'stale',
      intelligenceStatus: 'stale',
      actionPlanStatus: 'stale',
      simulationStatus: 'stale',
      reportStatus: 'stale',
      sourceResponseVersion: newVersion,
    };

    await tx.assessmentFlowState.upsert({
      where: { assessmentId },
      update: staleUpdate,
      create: { tenantId, assessmentId, ...staleUpdate },
    });
  }
}
