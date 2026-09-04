import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { isHQ } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';

/**
 * Porta local (Postgres/NestJS) de getFinancialJourneyState +
 * updateFinancialJourneyPosition (antes: funções serverless Base44).
 *
 * Fase 1: cobre só analysisType = 'individual'. As etapas de análises
 * combinadas/consolidadas (conciliação, cédula, combinação/preparação)
 * ficam para uma fase futura — ver comentário no schema.prisma.
 *
 * A etapa "analise" depende de buildFinancialStatements (Fase 2, portada em
 * financial-statements.service.ts) já ter rodado com sucesso para o upload
 * atual — ver analiseDone abaixo.
 */
const STEP_KEYS = ['estrutura', 'fontes', 'validacao', 'analise'] as const;
const STEP_LABELS: Record<string, string> = {
  estrutura: 'Estrutura',
  fontes: 'Fontes',
  validacao: 'Validação',
  analise: 'Análise',
};
const WRITE_ROLES = new Set(['hq_admin', 'tenant_admin', 'consultant']);

type StepKey = (typeof STEP_KEYS)[number];

@Injectable()
export class FinancialJourneyService {
  constructor(private readonly prisma: PrismaService) {}

  private rlsOpts(actor: AuthUser, tenantId?: string | null) {
    return { tenantId: tenantId ?? actor.tenantId, isHq: isHQ(actor.role) };
  }

  private assertTenantAccess(actor: AuthUser, tenantId: string) {
    if (isHQ(actor.role)) return;
    if (actor.tenantId !== tenantId) throw new ForbiddenException('Tenant scope violation');
  }

  async getState(actor: AuthUser, financialDiagnosisId: string) {
    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const diagnosis = await tx.financialDiagnosis.findFirst({
        where: { id: financialDiagnosisId, deletedAt: null },
      });
      if (!diagnosis) throw new NotFoundException('FinancialDiagnosis not found');
      this.assertTenantAccess(actor, diagnosis.tenantId);

      if (diagnosis.analysisType !== 'individual') {
        // Fases futuras: por ora não bloqueia o front, só devolve tudo
        // travado com uma mensagem clara em vez de tentar (e errar) a
        // lógica de conciliação/cédula que ainda não existe aqui.
        return this.buildUnsupportedAnalysisTypeState(diagnosis.analysisType);
      }

      const [activeUploads, validationResults] = await Promise.all([
        tx.financialUpload.findMany({
          where: { financialDiagnosisId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
        }),
        tx.financialValidationResult.findMany({
          where: { financialDiagnosisId, publicationStatus: 'active' },
        }),
      ]);

      const estruturaBlocking: string[] = [];
      if (!diagnosis.accountPlanId) estruturaBlocking.push('Plano de contas não vinculado.');
      if (!diagnosis.firstPeriod || !diagnosis.lastPeriod) {
        estruturaBlocking.push('Período (inicial/final) não definido.');
      }
      if (!diagnosis.groupId && !diagnosis.companyId && !diagnosis.unitId) {
        estruturaBlocking.push('Nenhuma empresa/unidade/grupo vinculado à análise.');
      }
      const estruturaDone = estruturaBlocking.length === 0;

      const fontesBlocking: string[] = [];
      const currentActiveUploads = activeUploads.filter(
        (u: { isCurrent: boolean | null; uploadStatus: string }) =>
          u.isCurrent !== false && ['validated', 'processed'].includes(u.uploadStatus),
      );
      if (!estruturaDone) {
        fontesBlocking.push('Complete a etapa "Estrutura" primeiro.');
      } else if (currentActiveUploads.length === 0) {
        fontesBlocking.push('Nenhum balancete validado enviado ainda.');
      }
      const fontesDone = estruturaDone && currentActiveUploads.length > 0;

      const blockingValidations = validationResults.filter(
        (r: { severity: string; blocking: boolean }) => r.severity === 'blocking' || r.blocking,
      ).length;
      const validacaoBlocking: string[] = [];
      if (!fontesDone) {
        validacaoBlocking.push('Complete a etapa "Fontes" primeiro.');
      } else if (validationResults.length === 0) {
        validacaoBlocking.push('Balancete ainda não foi validado.');
      } else if (blockingValidations > 0) {
        validacaoBlocking.push(
          `${blockingValidations} pendência(s) bloqueante(s) na validação do balancete.`,
        );
      }
      const validacaoDone = fontesDone && validationResults.length > 0 && blockingValidations === 0;

      // "análise" fica liberada quando buildFinancialStatements (Fase 2) já
      // rodou com sucesso para esta análise — currentProcessingSnapshotId
      // aponta pro FinancialProcessingRun succeeded mais recente (ver
      // financial-statements.service.ts).
      const analiseBlocking: string[] = [];
      const analiseDone =
        validacaoDone && diagnosis.status === 'processed' && !!diagnosis.currentProcessingSnapshotId;
      if (!validacaoDone) {
        analiseBlocking.push('Complete a etapa "Validação" primeiro.');
      } else if (!analiseDone) {
        analiseBlocking.push('Montagem das demonstrações (BP/DRE/DFC) ainda não foi concluída para este balancete.');
      }

      const doneByKey: Record<StepKey, boolean> = {
        estrutura: estruturaDone,
        fontes: fontesDone,
        validacao: validacaoDone,
        analise: analiseDone,
      };
      const blockingByKey: Record<StepKey, string[]> = {
        estrutura: estruturaBlocking,
        fontes: fontesBlocking,
        validacao: validacaoBlocking,
        analise: analiseBlocking,
      };

      let currentStepIdx = STEP_KEYS.findIndex((key) => !doneByKey[key]);
      if (currentStepIdx === -1) currentStepIdx = STEP_KEYS.length - 1;
      if (currentStepIdx === STEP_KEYS.length - 1 && !doneByKey.analise) {
        currentStepIdx = Math.max(0, currentStepIdx - 1);
      }

      const steps = STEP_KEYS.map((key, i) => ({
        key,
        label: STEP_LABELS[key],
        done: doneByKey[key],
        accessible: i <= currentStepIdx,
        blocking_reasons: blockingByKey[key],
      }));

      const canOpenAnalysis = validacaoDone && analiseDone;

      const savedPosition = await tx.financialJourneyPosition
        .findFirst({ where: { financialDiagnosisId, userId: actor.id } })
        .catch(() => null);
      const savedStep = savedPosition?.step ?? null;
      const savedStepValid =
        savedStep &&
        steps.find((s) => s.key === savedStep)?.accessible === true;

      return {
        analysis_type: diagnosis.analysisType,
        steps,
        current_step: STEP_KEYS[currentStepIdx],
        resolved_active_step: savedStepValid ? savedStep : STEP_KEYS[currentStepIdx],
        can_open_analysis: canOpenAnalysis,
      };
    });
  }

  private buildUnsupportedAnalysisTypeState(analysisType: string) {
    const steps = STEP_KEYS.map((key) => ({
      key,
      label: STEP_LABELS[key],
      done: false,
      accessible: false,
      blocking_reasons: [
        `Análises do tipo "${analysisType}" ainda não são suportadas neste ambiente local (planejado para uma fase futura).`,
      ],
    }));
    return {
      analysis_type: analysisType,
      steps,
      current_step: STEP_KEYS[0],
      resolved_active_step: STEP_KEYS[0],
      can_open_analysis: false,
    };
  }

  async updatePosition(actor: AuthUser, financialDiagnosisId: string, step: string) {
    if (!WRITE_ROLES.has(actor.role)) {
      throw new ForbiddenException('Papel sem permissão para atualizar a posição da jornada.');
    }
    if (!STEP_KEYS.includes(step as StepKey)) {
      throw new ForbiddenException(`Etapa inválida: ${step}`);
    }

    const state = await this.getState(actor, financialDiagnosisId);
    const target = state.steps.find((s) => s.key === step);
    if (!target?.accessible) {
      throw new ForbiddenException(
        `Etapa "${step}" ainda não está liberada: ${target?.blocking_reasons.join(' ') ?? ''}`,
      );
    }

    return this.prisma.withTenantContext(this.rlsOpts(actor), async (tx) => {
      const diagnosis = await tx.financialDiagnosis.findFirst({
        where: { id: financialDiagnosisId, deletedAt: null },
      });
      if (!diagnosis) throw new NotFoundException('FinancialDiagnosis not found');
      this.assertTenantAccess(actor, diagnosis.tenantId);
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, true)`,
        diagnosis.tenantId,
      );

      const position = await tx.financialJourneyPosition.upsert({
        where: {
          financialDiagnosisId_userId: { financialDiagnosisId, userId: actor.id },
        },
        create: {
          tenantId: diagnosis.tenantId,
          financialDiagnosisId,
          userId: actor.id,
          userEmail: actor.email,
          step,
        },
        update: { step, userEmail: actor.email },
      });
      return position;
    });
  }
}
